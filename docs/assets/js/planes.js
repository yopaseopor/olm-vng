var map = L.map('map', { fadeAnimation: false });
var hash = new L.Hash(map);









//------------- Legend control --------------------

L.Control.Legend = L.Control.extend({
    onAdd: map => {
        var div = L.DomUtil.create('div', 'leaflet-control-layers control-padding');
        div.innerHTML = "Legend";
        div.onmouseenter = setLegendBody;
        div.onmouseleave = setLegendHead;
        div.onclick = changeLegend;
        div.id = 'legend';
        return div;
    }
});

new L.Control.Legend({ position: 'bottomright' }).addTo(map);

function changeLegend(e) {
    if (this.onmouseenter == null) {
        setLegendHead(e);
        this.onmouseenter = setLegendBody;
        this.onmouseleave = setLegendHead;
    } else {
        setLegendBody(e);
        this.onmouseenter = this.onmouseleave = null;
    }
}

function setLegendBody(e) {
    e.currentTarget.innerHTML = legend
        .map(x => "<div class='legend-element' style='background-color:" + x.color + ";'></div> " + x.text)
        .join("<br />");
}

function setLegendHead(e) {
    e.currentTarget.innerHTML = "Legend";
}


var legend = [
    { condition: 'disc',        color: 'gold',          text: 'Disc'          },
    { condition: 'no_parking',  color: 'gold',          text: 'No parking'    },
    { condition: 'no_stopping', color: 'salmon',        text: 'No stopping'   },
    { condition: 'free',        color: 'limegreen',     text: 'Free parking'  },
    { condition: 'ticket',      color: 'dodgerblue',    text: 'Paid parking'  },
    { condition: 'customers',   color: 'greenyellow',   text: 'For customers' },
    { condition: 'residents',   color: 'hotpink',       text: 'For residents' }
];

var lanes = {};
var offset = 6;

var datetime = new Date();
document.getElementById('datetime-input').value =
    datetime.getFullYear() + '-' + (datetime.getMonth() + 1) + '-' + datetime.getDate() + ' ' +
    datetime.getHours() + ':' + datetime.getMinutes();

var urlOverpass = 'https://overpass-api.de/api/interpreter?data=';
var urlJosm = 'http://127.0.0.1:8111/import?url=';
var urlID = 'https://www.openstreetmap.org/edit?editor=id';

var lastBounds;

// ------------- functions -------------------

function mapMoveEnd() {
    document.getElementById('josm-bbox').href = urlJosm + urlOverpass + getQueryHighways();
    document.getElementById('id-bbox').href = urlID + '#map=' +
        document.location.href.substring(document.location.href.indexOf('#') + 1);
    setLocationCookie();
    
    if (map.getZoom() < 15) {
        document.getElementById("info").style.visibility = 'visible';
        return;
    }

    document.getElementById("info").style.visibility = 'hidden';

    if (withinLastBbox())
        return;

    lastBounds = map.getBounds();
    getContent(urlOverpass + encodeURIComponent(getQueryParkingLanes()), parseContent);
}

function withinLastBbox()
{
    if (lastBounds == undefined)
        return false;

    var bounds = map.getBounds();
    return bounds.getWest() > lastBounds.getWest() && bounds.getSouth() > lastBounds.getSouth() &&
        bounds.getEast() < lastBounds.getEast() && bounds.getNorth() < lastBounds.getNorth();
}

function parseContent(content) {
    var nodes = {};

    for (var obj of content.elements) {
        if (obj.type == 'node')
            nodes[obj.id] = [obj.lat, obj.lon];

        if (obj.type == 'way') {
            if (lanes[obj.id])
                continue;

            var polyline = obj.nodes.map(x => nodes[x]);

            for (var side of ['right', 'left']) {
                var conditions = getConditions(side, obj.tags);
                if (conditions.default != null)
                    addLane(polyline, conditions, side, obj, offset);
            }
        }
    }
}

function setLocationCookie() {
    var center = map.getCenter();
    var date = new Date(new Date().getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
    document.cookie = 'location=' + map.getZoom() + '/' + center.lat + '/' + center.lng + '; expires=' + date;
}

function setViewFromCookie() {
    var location = document.cookie.split('; ').find((e, i, a) => e.startsWith('location='));
    if (location == undefined)
        return false;
    location = location.split('=')[1].split('/');

    map.setView([location[1], location[2]], location[0]);
    return true;
}

function setDate() {
    datetime = new Date(document.getElementById('datetime-input').value);
    redraw();
}

function redraw() {
    for (var lane in lanes)
        lanes[lane].setStyle({ color: getColorByDate(lanes[lane].options.conditions) });
}

function getContent(url, callback)
{
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => callback(JSON.parse(xhr.responseText));
    xhr.send();
}

function getConditions(side, tags) {
    var conditions = { intervals: [], default: null };
    var sides = [side, 'both'];

    var defaultTags = sides.map(side => 'parking:condition:' + side + ':default')
        .concat(sides.map(side => 'parking:lane:' + side));

    for (var tag of defaultTags)
        if (tag in tags) {
            conditions.default = tags[tag];
            break;
        }

    for (var i = 1; i < 10; i++) {
        var index = i > 1 ? ':' + i : '';

        var conditionTags = sides.map(side => 'parking:condition:' + side + index);
        var intervalTags = sides.map(side => 'parking:condition:' + side + index + ':time_interval');

        var cond = {};

        for (var j = 0; j < sides.length; j++) {
            if (conditionTags[j] in tags)
                cond.condition = tags[conditionTags[j]];
            if (intervalTags[j] in tags)
                cond.interval = new opening_hours(tags[intervalTags[j]], null, 0);
        }

        if (i == 1 && cond.interval == undefined) {
            if ('condition' in cond)
                conditions.default = cond.condition;
            break;
        }

        if ('condition' in cond)
            conditions.intervals[i - 1] = cond;
        else
            break;
    }
    
    return conditions;
}

function addLane(line, conditions, side, osm, offset) {
    lanes[side == 'right' ? osm.id : -osm.id] = L.polyline(line,
        {
            color: getColorByDate(conditions),
            weight: 3,
            offset: side == 'right' ? offset : -offset,
            conditions: conditions,
            osm: osm
        })
        .addTo(map)
        .bindPopup('', { osm: osm });
}

function getColor(condition) {
    for (var element of legend)
        if (condition == element.condition)
            return element.color;
}

function getColorByDate(conditions) {
    for (var interval of conditions.intervals)
        if (interval.interval.getState(datetime))
            return getColor(interval.condition);
    return getColor(conditions.default);
}

function getQueryParkingLanes() {
    var bounds = map.getBounds();
    var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',');
    return '[out:json];(way[~"^parking:lane:.*"~"."](' + bbox + ');>;);out body;';
}

function getQueryHighways() {
    var bounds = map.getBounds();
    var bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',');
    var tag = 'highway~"^motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street"';
    return '[out:xml];(way[' + tag + '](' + bbox + ');>;way[' + tag + '](' + bbox + ');<;);out meta;';
}

function getQueryOsmId(id) {
    return '[out:xml];(way(id:' + id + ');>;way(id:' + id + ');<;);out meta;';
}


function getPopupContent(osm) {
    var regex = new RegExp('^parking:');
    var result = '';

    result += '<div style="min-width:200px">';
    result += '<a target="_blank" href="https://openstreetmap.org/way/' + osm.id + '">View in OSM</a>';
    result += '<span style="float:right">Edit: ';
    result += '<a target="_blank" href="' + urlJosm + urlOverpass + getQueryOsmId(osm.id) + '">Josm</a>';
    result += ', <a target="_blank" href="' + urlID + '&way=' + osm.id + '">iD</a>';
    result += '</span>';
    result += '</div>';

    result += '<hr>';

    for (var tag in osm.tags)
        if (regex.test(tag))
            result += tag + ' = ' + osm.tags[tag] + '<br />';
        
    return result;
}


map.on('moveend', mapMoveEnd);
map.on('popupopen', e => e.popup.setContent(getPopupContent(e.popup.options.osm)));
mapMoveEnd();
