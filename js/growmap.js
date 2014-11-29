var growMap = { VERSION: "0.1" };

(function() {
    /**
     * @var object reference to the global JS object
     */
    var global = (function() { return this; })();
    /**
     * @var object Local reference to public growmap
     */
    var grow = global.growMap;
    // ___PUBLIC___
    /**
     * Heatmap location radius
     * radius should be small ONLY if scaleRadius is true (or small radius is intended)
     * if scaleRadius is false it will be the constant radius used in pixels
     */
    grow.radius = 4;
    /**
     * Heatmap max opacity
     */
    grow.opacity = .8;
    /**
     * Custom on link click function to be set from frontend
     */
    grow.onLinkClick = null;
    /**
     * Intern on link click function that needs to be public
     * since specified as inline onclick event.
     */
    grow._onLinkClick = null;
    /**
     * @var string base url of API site, e.g. "www.growstuff.org/"
     * or "/growmap/index.php/main/"
     */
    grow.apiUrl = null;
    /**
     * @var string base url of the site, e.g. "www.growstuff.org/"
     * or "/growmap/"
     */
    grow.baseUrl = null;
    /**
     * @var bool use this var to tell the engine whether
     * it uses the original, limited growstuff API or the
     * alternative, extended PHP API that offers e.g. a function
     * to get all crop data at once.
     */
    grow.extendedAPI = false;

    // ___PRIVATE___
    /**
     * @var int initial zoom factor
     */
    var zoom = 3;
    /**
     * @var int initial center latitude & longitude
     */
    var center = [28.03, -16.48];
    /**
     * @var int lower time boundary to load events, in ms (js time epoch)
     */
    var dateBegin = null;
    /**
     * @var int upper time boundary to load events, in ms (js time epoch)
     */
    var dateEnd = null;
    /**
     * @var object d3 container element
     */
    var container = null;
    /**
     * @var object map object
     */
    var worldMap = null;
    /**
     * @var object map layer
     */
    var Layer = null;
    /**
     * @var object heat map layer
     */
    var heatLayer = null;
    /**
     * @var object marker cluster layer
     */
    var markerLayer = null;
    /**
     * @var object marker icon
     */
    var icon = null;
    /**
     * @var int map width
     */
    var Width = null;
    /**
     * @var int map height
     */
    var Height = null;
    /**
     * @var bool whether at least one update took place
     */
    var updated = false;
    /**
     * @var string HTML content to use in marker popups
     * NOTE: since markers are created dynamically we need
     * to set the onclick event inline. Thus we also need
     * the onclick function to be globally available.
     */
    var markerContent = null;
    /**
     * @var array array of crop objects set by update function
     */
    var crops = [];
    /**
     * @var int index of selected crop in crops array
     */
    var cropIdx = null;


// $('.leaflet-popup-content').html('<object data="http://growstuff.org/members/dasbero">')

    // ___PUBLIC___
    grow.init = function(_container) {
        container = _container;
        // remove map div
        $('#map').remove();

        // ---------------------------MAP-------------------------------
        // map div
        $(container).append('<div id="map"></div>');
        // map layer - "toner" or "terrain" or "watercolor"
        Layer = new L.StamenTileLayer("watercolor");
        // -------------------------HEATMAP-----------------------------
        // heatmap cfg
        var cfg = {
            "radius": grow.radius,
            "maxOpacity": grow.opacity,
            "scaleRadius": true, // scales the radius based on map zoom
            // if set to false the heatmap uses the global maximum for colorization
            // if activated: uses the data maximum within the current map boundaries
            // (=> there will always be a red spot with useLocalExtremas true)
            "useLocalExtrema": true,
            valueField: 'count', // field name in data representing the value
            latField: 'lat',     // field name in data representing the latitude
            lngField: 'lng'      // field name in data representing the longitude
        };
        // heat map layer
        heatLayer = new HeatmapOverlay(cfg);
        worldMap = new L.Map('map', {
            center: new L.LatLng(center[0], center[1]),
            zoom: zoom,
            layers: [Layer, heatLayer]
        });
        // -------------------------MARKERS-----------------------------
        markerContent =
            '<img src="'+grow.baseUrl+'img/mini.png"><br>' +
            '<a target="_blank" href="http://growstuff.org/plantings/__PLANTING__" data-crop="__CROP__">__CROP__</a> by ' +
            '<a target="_blank" href="http://growstuff.org/members/__OWNER1__" data-owner="__OWNER1__">__OWNER2__</a>' +
            '<br>__DATE__' +
            '<br><a target="blank_" href="__WIKI__"><img src="'+grow.baseUrl+'img/wiki.png"></a>';
        // marker cluster layer
        markerLayer = L.markerClusterGroup();
        worldMap.addLayer(markerLayer);
        // custom icon
        var iconType = L.Icon.extend({
            options: {
                iconUrl: grow.baseUrl+'img/icon_m.png',
                iconAnchor: [16, 48]
                //shadowUrl: grow.baseUrl+'img/shadow_m.png',
                //shadowAnchor: [10, 5]
            }
        });
        icon = new iconType();
        // ---------------------------UI--------------------------------
        // add select menus
        $(".leaflet-control-container").append(
            '<div class="leaflet-top leaflet-right">'+
            '<div class="leaflet-bar leaflet-control">'+
            '<fieldset>'+
            '<select name="crop" id="crop"></select>'+
            '</fieldset></div></div>'
        );
        $("#crop").change(function(event) {
            cropIdx = $("#crop").prop("selectedIndex");
            grow.update();
        });
        // add slider
        $(".leaflet-control-container").append(
            '<div class="leaflet-bottom leaflet-left">'+
            '<div class="leaflet-bar leaflet-control">'+
            '<label id="dateRange"></label><br>'+
            '<div id="slider"></div></div></div>'
        );
        $("#slider").slider();
        grow.setBeginEnd((new Date(2013, 1, 1)).getTime(), (new Date()).getTime());
        $("#slider").slider({animate: "fast",
            min: grow.getBeginEnd()[0],
            max: grow.getBeginEnd()[1],
            step: 1000,
            start: onSliderChange,
            stop: onSliderChanged
        });
        $("#slider").slider("option", "range", true);
        $("#slider").slider("option", "values", grow.getBeginEnd());
        var range = grow.getBeginEnd();
        $("label#dateRange").html(
            getDateStr(range[0]) + "&#8199; to &#8199;" + getDateStr(range[1])
        );


        // bind events
        $(window).resize(resize);
        // update crops only once every session - not much would change
        grow.updateCrops();
    }

    grow.updateCrops = function() {
        if (!updated) {
            // get & add the crops to the list
            requestJSON('crops.json', function (response) {
                var json = response.responseJSON;
                var totalCount = 0;
                // add crops to array
                for (var i = 0; i < json.length; i++) {
                    crops.push({
                        id: parseInt(json[i]['id']),
                        name: json[i]['name'],
                        count: parseInt(json[i]['plantings_count']),
                        wikiUrl: json[i]['en_wikipedia_url']
                    });
                    totalCount = totalCount + parseInt(json[i]['plantings_count']);
                }
                // sort crops by count
                crops.sort(function (a, b) {
                    return b.count - a.count;
                });
                cropIdx = 0;
                // add "all" option to list
                $('select#crop').append('<option selected="selected">' +
                    'all (' + (totalCount.toString()) +
                    ')</option>'
                );
                // add crops to list
                for (var i = 0; i < crops.length; i++) {
                    $('select#crop').append('<option>' +
                        crops[i].name + ' (' + (crops[i].count.toString()) +
                        ')</option>'
                    );
                }
                updated = true;
                // update map
                grow.update();
            });
        }
    }

    /**
     * update map
     *
     * Requests selected crop data and updates map with it.
     * The function has three modes: either it gets the one selected
     * option is selected. In the latter case it either gets the data
     * for each crop one by one (if using the original, limited growstuff
     * API) by recursive calls or it gets the data for all crops at once
     * (if using the alternative, extended PHP API).
     */
    grow.update = function() {
        // first update settings crops array already done
        var cropsList;     // crops to request via AJAX
        var ajaxCount = 0; // how many AJAX calls have been completed
        // define new marker layer
        var newMarkerLayer = L.markerClusterGroup();
        // define data array for heatmap
        var data = [];

        // local function adding map markers for all plantings of given crop
        // to "newMarkerLayer" and heatmap data to "data" array.
        // ONLY adding plantings with creation- or finish-date between dateBegin & dateEnd.
        // NOT adding newMarkerLayer or data to map. Use addLayerAddData therefore.
        var addCrop = function(crop) {
            var plantings = crop.plantings;
            // add markers & apply formula on counts
            for (var j = 0; j < plantings.length; j++) {
                var createDate = plantings[j].created_at;
                var finishDate = plantings[j].finished_at;
                // only add planting if in date range
                if( ((new Date(createDate)) > (new Date(dateBegin)) &&
                    (new Date(createDate)) < (new Date(dateEnd))
                    ) ||
                    ((new Date(finishDate)) > (new Date(dateBegin)) &&
                     (new Date(finishDate)) < (new Date(dateEnd))
                    )) {
                    var owner = plantings[j].owner;
                    var plantingID = plantings[j].id;
                    var wikiUrl = crop.en_wikipedia_url;
                    var lat = owner.latitude;
                    var lng = owner.longitude;
                    var ownerName = owner.login_name;
                    var cropName = crop.name;
                    var cropCount = crop.plantings_count;
                    if (lat != null && lng != null) {
                        var marker = L.marker([lat, lng], {icon: icon})
                            .bindPopup(markerContent
                                .replace(/__CROP__/g, cropName)
                                .replace(/__PLANTING__/g, plantingID)
                                .replace(/__OWNER1__/g, ownerName.toLowerCase())
                                .replace(/__OWNER2__/g, ownerName)
                                .replace(/__WIKI__/g, wikiUrl)
                                .replace(/__DATE__/g, createDate));
                        newMarkerLayer.addLayer(marker);
                        data.push({
                            lat: lat,
                            lng: lng,
                            count: 1 // always one planting
                        });
                    }
                }
            }
        };

        // local function removing old marker layer & adding "newMarkerLayer"
        // and adding heatmap data from "data" array
        var addLayerAddData = function() {
            // remove old & set new marker layer
            worldMap.removeLayer(markerLayer);
            markerLayer = newMarkerLayer;
            worldMap.addLayer(markerLayer);
            // set heatmap data
            if (data.length > 0) {
                heatLayer.setData({data: data});
            }
        }

        // local, recursive function to request crops in cropsList via
        // original API doing separate AJAX calls.
        var request = function self(i) {
            i = (typeof i == 'undefined') ? 0 : i;
            var cropID = cropsList[i].id.toString();
            requestJSON('crops/' + cropID + '.json', function (response) {
                ajaxCount++;
                // add markers for given crop to "newMarkerLayer"
                // and heatmap data to "data" array
                addCrop(response.responseJSON);
                // if this is the last returning AJAX call
                if(ajaxCount >= cropsList.length) {
                    addLayerAddData();
                }
            });
            // recursion until done
            i++;
            if(i < cropsList.length) {
                self(i);
            }
        };

        // local function to request all crops at once via extended API
        var requestAll = function() {
            requestJSON('crops/-1.json', function (response) {
                var allCrops = response.responseJSON;
                for(var i = 0; i < allCrops.length; i++) {
                    addCrop(allCrops[i]);
                }
                addLayerAddData();
            });
        }

        // when "all" selected and using extended API
        if( grow.extendedAPI && (cropIdx == 0) ) {
                requestAll();
        }
        else {
            // do all crops or just one specific
            cropsList = (cropIdx == 0) ?
                crops :
                [crops[cropIdx]];
            // start recursive request using cropsList
            request();
        }
    }

    /**
     * on click on a link in a marker popup
     *
     * we have this internal "onclick" to be able to pass misc data to the
     * "onclick" function bound by the user - it needs to be public because
     * it has to be bound inline to the frontend function.
     */
    grow._onLinkClick = function(e) {
        if(typeof grow.onLinkClick == 'function') {
            return grow.onLinkClick(e, e.target.dataset.name);
        }

        return false;
    }

    /**
     * Sets dateBegin & dateEnd to the given values
     *
     * @return void
     */
    grow.setBeginEnd = function(begin, end) {
        dateBegin = begin;
        dateEnd = end;
    }

    /**
     * Gets dateBegin & dateEnd.
     * Returns them as two dimensional array.
     *
     * @return array
     */
    grow.getBeginEnd = function() {
        return [dateBegin, dateEnd];
    }

    // ___PRIVATE___
    // get width & height from container object
    var updateWidthHeight = function() {
        Width  = parseInt($(container).width());
        Height = parseInt($(container).height());
    }

    // get date string from JS epoch time
    var getDateStr = function(unixTime) {
        dateObj = new Date(unixTime);
        var dateStr =
            (dateObj.getYear()+1900).toString() + '-' +
            dateObj.getMonth().toString() + '-' +
            dateObj.getDay().toString();

        return dateStr;
    }

    // on slider done changing
    var onSliderChanged = function(event, ui) {
        grow.setBeginEnd(ui.values[0], ui.values[1]);
        // set slider label
        $("label#dateRange").html(
            getDateStr(ui.values[0]) +
            "&#8199; to &#8199;" +
            getDateStr(ui.values[1])
        );
        // re-enable map scrolling
        worldMap.dragging.enable();
        // update map
        grow.update();
    }

    // on slider change being started
    var onSliderChange = function(event, ui) {
        worldMap.dragging.disable(); // prevents map from scrolling
    }

    // on window resize
    var resize = function() {
        updateWidthHeight();
        $('#map').css({width: Width, height: Height});
    }

    var requestJSON = function(urlSuffix, callback) {
        var jqxhr = $.ajax({
            dataType: "json",
            url: grow.apiUrl+urlSuffix,
            complete: function(response, a, b, c) {
                callback(response);
            },
            error: function() { console.log( "API error" ); },
            crossDomain: true
        });
    }

    console.log("loaded growmap");
})();