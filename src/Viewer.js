/* ========================================================================
 * Copyright 2014 Mälardalskartan
 * Licensed under BSD 2-Clause (https://github.com/malardalskartan/mdk/blob/master/LICENSE.txt)
 * ======================================================================== */

var Viewer = (function($){
 
  var map, mapControls;

  var settings = {
    projection: '',
    projectionCode: '',
    projectionExtent: '',
    extent: [],    
    center: [0, 0],
    zoom: 0,
    resolutions: null, 
    source: {},
    layers: []
  };
 
  return {
    init: function(mapSettings){
        //Map settings to use for this viewer       
        settings.projectionCode = mapSettings.projectionCode;
        settings.projectionExtent = mapSettings.projectionExtent;
        settings.projection = ol.proj.get(settings.projectionCode);
        settings.projection.setExtent(settings.projectionExtent);
        settings.extent = mapSettings.extent;                 
        settings.center = mapSettings.center;
        settings.zoom = mapSettings.zoom;
        settings.resolutions = mapSettings.resolutions;
        settings.source = mapSettings.source;
        this.createLayers(mapSettings.layers); //read layers from mapSettings      

        //If url arguments, parse this settings
        if (window.location.search) {
            this.parseArg();
        }    

        //Set map controls
        mapControls = [
                new ol.control.Zoom({zoomInTipLabel: null, zoomOutTipLabel:null,zoomInLabel: '', zoomOutLabel:''}),
                new ol.control.Attribution({collapsible: false}),
                new ol.control.Rotate({label: ''}), /*Override default label for compass*/
                new ol.control.ScaleLine()
        ]; 
        if(window.top!=window.self) {
            MapWindow.init();
        }
        else {
            mapControls.push(new ol.control.FullScreen());
        }    

    	this.loadMap();
      this.addGetFeatureInfo();

      MapMenu.init([{
        itemName: 'ShareMap'
      }
      ]);
      ShareMap.init();
      Geoposition.init();
      Print.init();
    },
    createLayers: function(layerlist) {
        for(var i=layerlist.length-1; i>=0; i--) {
            if(layerlist[i].type == 'WMTS') {
                settings.layers.push(Viewer.addWMTS(layerlist[i]));
            }
            else if(layerlist[i].type == 'WMS') {
                settings.layers.push(Viewer.addWMS(layerlist[i]));
            }
            else if(layerlist[i].type == 'WFS') {
                settings.layers.push(Viewer.addWFS(layerlist[i]));
            }
            else if(layerlist[i].type == 'GEOJSON') {
                settings.layers.push(Viewer.addGeoJson(layerlist[i]));
            }            
        }
    },
    loadMap: function(){
	    map = new ol.Map({
	      target: 'map',
	      controls: mapControls,
	      layers: settings.layers,
	      view: new ol.View({
          renderer: 'canvas',
          extent: settings.extent,
	      	projection: settings.projection,
	        center: settings.center,
          resolutions: settings.resolutions,
	        zoom: settings.zoom
	      })
	    });    	
    },
    parseArg: function(){
    	var str = window.location.search.substring(1);
    	var elements = str.split("&");          

    	for (var i = 0; i < elements.length; i++) {
            //center coordinates
            if (i==0) {
                var z = elements[i].split(",");
                settings.center[0] = parseInt(z[0]);
                settings.center[1] = parseInt(z[1]);              
            }
            else if (i==1) {
                settings.zoom = parseInt(elements[i]);
            }             
    		else if (i==2) {
                var l = elements[i].split(",");
                var layers = settings.layers;
                for (var j = 0; j < l.length; j++) {  
                    $.each(layers, function(index, el) {
                      if (l[j] == el.get('name')) {
                        el.setVisible(true);
                      }
                    })                    
    		    }
    	    }              
        }
    	 	
    },
    getSettings: function () {
      return settings;
    },
    getMapUrl: function () {
      var layerNames = '', url;
      //delete search arguments if present
      if (window.location.search) {
          url = window.location.href.replace(window.location.search, '?');
      }
      else {
          url = window.location.href + '?';    
      }
      var mapView = map.getView();
      var center = mapView.getCenter();
      for (var i=0; i < 2; i++) {
        center[i]=parseInt(center[i]); //coordinates in integers
      }
      var zoom = mapView.getZoom();
      var layers = map.getLayers();
      //add layer if visible
      layers.forEach(function(el) {
        if(el.getVisible() == true) {
            layerNames += el.get('name') + ',';
        }
      })
      return url + center + '&' + zoom + '&' + layerNames.slice(0, layerNames.lastIndexOf(","));
    },
    getMap: function() {
      return map;
    },
    getLayers: function() {
      return settings.layers;
    },
    getLayer: function(layername) {    
        var layer = $.grep(settings.layers, function(obj) {
           return (obj.get('name') == layername);
        }); 
        return layer[0];       
    },
    getGroup: function(group) {    
        var group = $.grep(settings.layers, function(obj) {
            return (obj.get('group') == group);
        }); 
        return group;       
    },    
    addWMS: function(layersConfig) {    

        return new ol.layer.Tile({
          name: layersConfig.name.split(':').pop(), //remove workspace part of name
          group: layersConfig.group || 'default',
          opacity: layersConfig.opacity || 1,          
          title: layersConfig.title,
          type: layersConfig.type,
          visible: layersConfig.visible,           
          source: new ol.source.TileWMS(({
            url: settings.source[layersConfig.source].url,
            gutter: layersConfig.gutter || 0,
            crossOrigin: 'anonymous',
            projection: settings.projection,
            params: {'LAYERS': layersConfig.name, 'TILED': true, VERSION: settings.source[layersConfig.source].version}
          }))
        })        
    },
    addWMTS: function(layersConfig) {
        var matrixIds = [], attr = null;
        for (var z = 0; z < settings.resolutions.length; ++z) {
          matrixIds[z] = settings.projectionCode + ':' + z;
        }

        layersConfig.hasOwnProperty('attribution') ? attr=[new ol.Attribution({html: layersConfig.attribution})] : [attr = null];

        return new ol.layer.Tile({
           group: layersConfig.group || 'background',          
           name: layersConfig.name.split(':').pop(), //remove workspace part of name
           opacity: layersConfig.opacity || 1,
           title: layersConfig.title,
           visible: layersConfig.visible,
           source: new ol.source.WMTS({
             crossOrigin: 'anonymous',
             attributions: attr,
             url: settings.source[layersConfig.source].url,
             projection: settings.projection,
             layer: layersConfig.name,
             matrixSet: settings.projectionCode,
             format: layersConfig.format,
             tileGrid: new ol.tilegrid.WMTS({
               origin: ol.extent.getTopLeft(settings.projectionExtent),
               resolutions: settings.resolutions,
               matrixIds: matrixIds
             }),                       
             extent: settings.extent, //layer extent to avoid bad requests out of range
             style: 'default'
           })
        })
    },
    addGeoJson: function(layersConfig) {
        return new ol.layer.Vector({
          group: 'none',
          name: layersConfig.name.split(':').pop(),
          opacity: layersConfig.opacity || 1,
          title: layersConfig.title,
          visible: layersConfig.visible,
          source: new ol.source.GeoJSON({
            url: layersConfig.source
          }),
          style: new ol.style.Style({
            fill: layersConfig.style['fill'] ? new ol.style.Fill(layersConfig.style['fill']) : null,
            stroke: layersConfig.style['stroke'] ? new ol.style.Stroke(layersConfig.style['stroke']) : null
          })                  
        })
    },    
    // addWFS: function(layersConfig) {
    //     var vectorSource = new ol.source.ServerVector({
    //       format: new ol.format.GeoJSON(),
    //       loader: function(extent, resolution, projection) {
    //         var url = settings.source[layersConfig.source].url + '?service=WFS&' +
    //             'version=1.1.0&request=GetFeature&typeName=' + layersConfig.name +
    //             '&outputFormat=text/javascript&format_options=callback:loadFeatures' +
    //             '&srsname=' + settings.projectionCode + '&bbox=' + extent.join(',') + ',' + settings.projectionCode;
    //         $.ajax({
    //           url: url,
    //           dataType: 'jsonp',
    //           error: function(jqXHR, textStatus, errorThrown) {
    //             alert(errorThrown);
    //           },
    //           loadFeatures: function(response) {
    //               alert('hej');
    //               vectorSource.addFeatures(vectorSource.readFeatures(response));
    //           }
    //         });
    //       },
    //       strategy: ol.loadingstrategy.createTile(new ol.tilegrid.XYZ({
    //         maxZoom: settings.resolutions.length
    //       })),
    //       projection: settings.projectionCode
    //     });

    //     //Callback function for jsonp
    //     var loadFeatures = function(response) {
    //       alert('hej');
    //       vectorSource.addFeatures(vectorSource.readFeatures(response));
          
    //     }; 
            
    //     return new ol.layer.Vector({
    //       name: layersConfig.name.split(':').pop(),
    //       title: layersConfig.title,
    //       source: vectorSource,
    //       style: new ol.style.Style({
    //         image: new ol.style.Circle({
    //           radius: 20,
    //           fill: new ol.style.Fill({color: 'black'})
    //         })
    //       })
    //     })
    // },
    addGetFeatureInfo: function() {
        Popup.init('#map');

        var overlay = new ol.Overlay({
          element: $('#popup')
        });

        map.on('singleclick', function(evt) {
          var element = overlay.getElement();
          var coordinate = evt.coordinate;
          var layer, queryLayers=[];
          for(var i=0; i<settings.layers.length; i++) {
            layer = settings.layers[i];
            if(layer.get('type')=='WMS' && layer.getVisible()==true) {
              (function(l) {
              var url = layer.getSource().getGetFeatureInfoUrl(
              evt.coordinate, map.getView().getResolution(), settings.projection,
              {'INFO_FORMAT': 'text/html'});
                $.post(url, function(data) {
                  var match = data.match(/<body[^>]*>([\s\S]*)<\/body>/);
                    if (match && !match[1].match(/^\s*$/)) {
                      if(queryLayers.length==0) {
                      queryLayers.push(data);

                      overlay.setPosition(coordinate);
                      
                      Popup.setContent({content: data, title: l.get('title')});
                      Popup.setVisibility(true);

                      /*Workaround to remove when autopan implemented for overlays */
                        var el=$('.popup');
                        var center = map.getView().getCenter();
                        var popupOffset = $(el).offset();
                        var mapOffset = $('#' + map.getTarget()).offset();
                        var offsetY = popupOffset.top - mapOffset.top;
                        var mapSize = map.getSize();
                        var offsetX = (mapOffset.left + mapSize[0])-(popupOffset.left+$(el).outerWidth(true));
                        // Check if mapmenu widget is used and opened
                        var menuSize = 0;
                        if(MapMenu) {
                          menuSize = MapMenu.getTarget().offset().left > 0 ? mapSize[0]- MapMenu.getTarget().offset().left : menuSize = 0;                 
                        }
                        if (offsetY < 0 || offsetX < 0 + menuSize || offsetX > (mapSize[0]-$(el).outerWidth(true))) {
                          var dx = 0, dy = 0;
                          if (offsetX < 0 + menuSize) {
                            dx = (-offsetX + menuSize)*map.getView().getResolution();
                          }
                          if (offsetX > (mapSize[0]-$(el).outerWidth(true))) {
                            dx = -($(el).outerWidth(true)-(mapSize[0]-offsetX))*map.getView().getResolution();
                          }                         
                          if (offsetY < 0) {
                            dy = (-offsetY)*map.getView().getResolution();
                          }
                          var pan = ol.animation.pan({
                            duration: 300,
                            source: center
                          });
                          map.beforeRender(pan);
                          map.getView().setCenter([center[0]+dx, center[1]+dy]);

                        }
                      /*End workaround*/

                      }/*End if empty*/
                      else {
                        queryLayers.push(data);;
                      }
                    }
                    else {
                      // $(element).popover('hide');
                      Popup.setVisibility(false);
                    }
                });//end post
              })(layer) //end post function
              } //end if
              } //end for
          
          map.addOverlay(overlay);
          evt.preventDefault();
        });
          
    }  
  };
 
})(jQuery);