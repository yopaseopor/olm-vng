function get_poi(element) {
    if ($('#expert-mode').is(':checked'))
	return {
	    name: 'Custom Query',
	    iconName: 'notvisited'
	}

    // TODO: improve this
    var type = ''
    if (e.tags.internet_access) type = 'internet_access';
    if (e.tags.highway) {
        if (type == '') type = e.tags.highway;
    }
    if (e.tags.amenity) {
        if (type == '') type = e.tags.amenity;
    }
    if (e.tags.tourism) {
        if (type == '') type = e.tags.tourism;
    }
    if (e.tags.shop) {
	if (e.tags.car_repair == 'wheel_repair') type = 'wheel_repair';
	if (type == '') type = e.tags.shop;
    }
    if (e.tags.sport) {
	if (e.tags.shooting == 'paintball') type = 'paintball';
	if (type == '') type = e.tags.shooting;
    }
    if (e.tags.leisure) {
	if (type == '') type = e.tags.leisure;
    }
    if (e.tags.office) {
	if (type == '') type = e.tags.office;
    }
    if (e.tags.craft) {
	if (type == '') type = e.tags.craft;
    }
    if (e.tags.historic) {
	if (type == '') type = e.tags.historic;
    }

    var poi = pois[type];
    return poi;
}


// https://github.com/kartenkarsten/leaflet-layer-overpass
function callback(data) {
    if (spinner > 0) spinner -= 1;
    if (spinner == 0) $('#spinner').hide();

    for(i=0; i < data.elements.length; i++) {
	e = data.elements[i];

	if (e.id in this.instance._ids) return;
	this.instance._ids[e.id] = true;

	var pos = (e.type == 'node') ?
	    new L.LatLng(e.lat, e.lon) :
	    new L.LatLng(e.center.lat, e.center.lon);

	var poi = get_poi(e)
	// skip this undefined icon
	if (!poi) {
	    console.info('Skipping undefined icon: "' + type + '"');
	    continue;
	}

	var markerIcon  = L.icon({
	    iconUrl: 'assets/img/icons/' + poi.iconName + '.png',
	    iconSize: [32, 37],
	    iconAnchor: [18.5, 35],
	    popupAnchor: [0, -27]
	});
	var marker = L.marker(pos, {
	    icon: markerIcon,
	    keyboard: false
	})

	// show a label next to the icon on mouse hover
	if (e.tags.name) {
	    marker.bindLabel(
		e.tags.name,
		{direction: 'auto', offset: [27, -32]}
	    );
	}

	// used to show the expert mode panel side
	marker._element = e;
	marker.on('click', function(e) {
	    var element = e.target._element;
	    $('#developer > .tags').html(develop_parser(element));
	});

	if (poi.tagParser) var markerPopup = poi.tagParser(e);
	else var markerPopup = generic_poi_parser(e, poi.name);

	marker.bindPopup(markerPopup);
	marker.addTo(this.instance);
    }
}

function build_overpass_query() {
    query = '(';
    $('#pois input:checked').each(function(i, element) {
	query += 'node(BBOX)' + pois[element.dataset.key].query + ';';
	query += 'way(BBOX)' + pois[element.dataset.key].query + ';';
	query += 'relation(BBOX)' + pois[element.dataset.key].query + ';';
    });
    query += ');out center;';
}

function setting_changed() {
    // remove pois from current map
    iconLayer.clearLayers();
    // uncheck the expert mode
    $('#expert-mode').attr('checked', false);
    $('#expert-form').hide();
    build_overpass_query();
    show_overpass_layer();
}

function show_pois_checkboxes() {
    // build the content for the "Home" sidebar pane
    var i = 0;
    var content = '';
    content += '<table>';
    for (poi in pois) {
	if (i % 2 == 0) content += '<tr>';
	content += '<td>';
	var checkbox = Mustache.render(
	    '<div class="poi-checkbox"> \
		<label> \
		    <img src="assets/img/icons/{{icon}}.png"></img> \
		    <input type="checkbox" data-key="{{key}}" onclick="setting_changed()"><span>{{name}}</span> \
		</label> \
	    </div>',
	    {key: poi, name: pois[poi].name, icon: pois[poi].iconName}
	);
	content += checkbox;
	content += '</td>';
	i++;
	if (i % 2 == 0) content += '</tr>';
    }
    content += '</table>';
    $('#pois').append(content);
}

function show_overpass_layer() {
    // remove tags from expert mode
    $('#develop p.tags').html('');

    if (query == '' || query == '();out center;') {
	console.debug('There is nothing selected to filter by.');
	return;
    }
    var opl = new L.OverPassLayer({
	query: query,
	callback: callback,
	minzoom: 14
    });

    iconLayer.addLayer(opl);
}

function get_permalink() {
    var uri = URI(window.location.href);
    var selectedPois = [];
    $('#pois input:checked').each(function(i, element) {
	selectedPois.push(element.dataset.key);
    });

    uri.query({'pois': selectedPois, 'norestoreview': true});
    return uri.href();
}

function update_permalink() {
    var link = get_permalink();
    $('#permalink').attr('href', link);
}

function expert_call() {
    var value = $('input[name=query]').attr('value');

    query = '(';
    query += 'node(BBOX){{value}};';
    query += 'way(BBOX){{value}};';
    query += 'relation(BBOX){{value}};';
    query += ');out center;';
    query = Mustache.render(
	query,
	{value: value}
    )
    console.debug(query);
    // uncheck all the POIs to avoid confusion
    // $('#pois input').attr('checked', false);
    iconLayer.clearLayers();
    show_overpass_layer();
}

function expert_mode_init() {
    $('#expert-form').submit(function (e) {
	e.preventDefault();
	expert_call();
    });

    $('#expert-mode').attr('checked', false);
    $('#expert-mode').click(function (e) {
	$('#expert-form').toggle();
    });

}

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

// bounding coordinates for minimap
$('#minimap > map > area').click(function () {
	var mLoc = $(this).attr('title'), mBounds = [];
	switch (mLoc) {
		case 'Bexhill': mBounds = LBounds; break;
		case 'Barnhorn': mBounds = [[50.8507, 0.4301], [50.8415, 0.4066]]; break;
		case 'Central': mBounds = [[50.8425, 0.4801], [50.8351, 0.4649]]; break;
		case 'Collington': mBounds = [[50.8472, 0.4604], [50.8352, 0.4406]]; break;
		case 'Cooden': mBounds = [[50.8417, 0.4416], [50.8305, 0.4195]]; break;
		case 'Glenleigh Park': mBounds = [[50.8573, 0.4641], [50.8476, 0.4454]]; break;
		case 'Glyne Gap': mBounds = [[50.8485, 0.5102], [50.8423, 0.4954]]; break;
		case 'The Highlands': mBounds = [[50.8637, 0.4615], [50.8566, 0.4462]]; break;
		case 'Little Common': mBounds = [[50.8501, 0.4424], [50.8399, 0.4244]]; break;
		case 'Old Town': mBounds = [[50.8484, 0.4841], [50.8419, 0.4706]]; break;
		case 'Pebsham': mBounds = [[50.8589, 0.5140], [50.8472, 0.4882]]; break;
		case 'Sidley': mBounds = [[50.8607, 0.4833], [50.8509, 0.4610]]; break;
	}
	if (mBounds) map.flyToBounds(L.latLngBounds(mBounds));
});

