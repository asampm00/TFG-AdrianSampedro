const WIDTH = 321
const HEIGHT = 161
const MAX_ZOOM = 1
const MEDIUM_ZOOM = 2
const MIN_ZOOM = 3

var map = L.map('map').setView([51.505, -0.09], 6);

// Base map

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 10,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  crs: L.CRS.EPSG4326

}).addTo(map);


let geojsonLayer = null

// #region Zoom Level Label
const ZoomViewer = L.Control.extend({
  onAdd() {
    const container = L.DomUtil.create('div');
    const gauge = L.DomUtil.create('div');
    container.style.width = '200px';
    container.style.background = 'rgba(255,255,255,0.5)';
    container.style.textAlign = 'left';
    map.on('zoomstart zoom zoomend load', (ev) => {
      gauge.innerHTML = `Zoom level: ${map.getZoom()}`;
    });
    container.appendChild(gauge);
    return container;
  }
});
const zoomViewerControl = (new ZoomViewer()).addTo(map);
// #endregion

// #region Scale Label
var scale = L.control.scale()
scale.addTo(map)
// #endregion

// #region Algoritmo selector
let alg = document.algorithmForm.algorithm;
let previousAlgorithm = null;
let currentAlgorithm = "min"
for (var i = 0; i < alg.length; i++) {
  alg[0].checked = true
  alg[i].addEventListener('change', function() {
        if (this !== previousAlgorithm) {
          previousAlgorithm = this;
        }
        currentAlgorithm = this.value
        zoomListener()
      });
}
// #endregion

// #region Ramp Color Selector
let colorRamp = document.colorRampForm.color;
let previousColor = null;
let currentColor = "minus"
for (var i = 0; i < colorRamp.length; i++) {
  colorRamp[0].checked = true
  colorRamp[i].addEventListener('change', function() {
        if (this !== previousAlgorithm) {
          previousColor = this;
        }
        currentColor = this.value
        zoomListener()
      });
}
// #endregion


let dataAux = null
let data3 = null
let prevZoom = 6

// #region Zoom Event Listener
map.on('zoomend', zoomListener)

function zoomListener() {
  if (map.getZoom() >= 7 && prevZoom != MAX_ZOOM) { 
    if (geojsonLayer) {
      prevZoom = MAX_ZOOM
      cleanMap()
      geojsonLayer = newGeoJsonLayer(aggregatePolygons(MAX_ZOOM)).addTo(map)
    }
  }

  if (map.getZoom() < 7 && map.getZoom() >= 4 && prevZoom != MEDIUM_ZOOM) { 
    if (geojsonLayer) {
      prevZoom = MEDIUM_ZOOM
      cleanMap()
      geojsonLayer = newGeoJsonLayer(aggregatePolygons(MEDIUM_ZOOM)).addTo(map)
    }
  }
 if (map.getZoom() < 5 && prevZoom != MIN_ZOOM) { 
    if (geojsonLayer) {
      prevZoom = MIN_ZOOM
      cleanMap()
      geojsonLayer = newGeoJsonLayer(aggregatePolygons(MIN_ZOOM)).addTo(map)
    }
  }
  return;
}
// #endregion

// #region Algoritmos de agregacion
var Aggregation = function () {
  this.algorithm = "";
}

Aggregation.prototype = {
  setAggregationAlgorithm: function (algorithm) {
    this.algorithm = algorithm;
  },

  calculate: function (values){
    return this.algorithm.calculate(values)
  }
}

var MeanValue = function () {
  this.calculate = function (values){
    let value = 0
    for(let i = 0; i < values.length; i++){
      value += values[i]
    }
    return value/values.length
  }
}

var MaxValue = function () {
  this.calculate = function (values){
  let value = 0
  for(let i = 0; i < values.length; i++){
    if(value < values[i]){
      value = values[i]
    }
  }
  return value
}}

var MinValue = function () {
  this.calculate = function (values){
  let value = 300
  for(let i = 0; i < values.length; i++){
    if(value > values[i]){
      value = values[i]
    }
  }
  return value
}}
// #endregion

// #region Agregation algorithm
function aggregatePolygons(tamCuadrado) {
  let dataAggregate = JSON.parse(JSON.stringify(data3))
  dataAggregate.features = []

  let cuadrado = []


  for (let i = tamCuadrado - 1; i < HEIGHT; i += tamCuadrado) {
    if (i >= HEIGHT) {
      continue;
    }
    for (let j = tamCuadrado - 1; j < WIDTH; j += tamCuadrado) {
      if (j >= WIDTH) {
        continue;
      }
      cuadrado = []

      cuadrado.push((i -(tamCuadrado- 1)) * WIDTH + j - (tamCuadrado - 1))
      cuadrado.push((i - (tamCuadrado- 1)) * WIDTH + j)
      cuadrado.push(i * WIDTH + j)
      cuadrado.push(i * WIDTH + j - (tamCuadrado - 1))

      dataAggregate.features.push(getCuadrado(cuadrado, tamCuadrado))


    }
  }

  return dataAggregate
}

function getCuadrado(coords, tamCuadrado) {
  let newFeature = JSON.parse(JSON.stringify(dataAux.features[coords[0]]))
  let newValue = 0
  let values = []
  let aggregation = new Aggregation()

  for (let i = 0; i < tamCuadrado; i++) {
    for (let j = 0; j < tamCuadrado; j++) {
      values.push(dataAux.features[WIDTH * i + coords[0] + j].properties[0])
      
    }
  }

  let algorithmStrategy = null
  switch(currentAlgorithm){
    case 'min':
      algorithmStrategy = new MinValue()
      break
    case 'max':
      algorithmStrategy = new MaxValue()
      break
    case 'mean':
      algorithmStrategy = new MeanValue()
      break
    default:
      console.error('Unknown algorithm.')
      break
  }

  aggregation.setAggregationAlgorithm(algorithmStrategy)
  newValue = aggregation.calculate(values)

  newFeature.properties[0] = newValue

  newFeature.geometry.coordinates[0][0][0] = dataAux.features[coords[0]].geometry.coordinates[0][0][1]
  newFeature.geometry.coordinates[0][0][1] = dataAux.features[coords[1]].geometry.coordinates[0][0][2]
  newFeature.geometry.coordinates[0][0][2] = dataAux.features[coords[2]].geometry.coordinates[0][0][3]
  newFeature.geometry.coordinates[0][0][3] = dataAux.features[coords[3]].geometry.coordinates[0][0][0]
  newFeature.geometry.coordinates[0][0][4] = dataAux.features[coords[0]].geometry.coordinates[0][0][0]


  return newFeature
}
// #endregion

// #region Get Data Geoserver
var owsrootUrl = 'http://localhost:8080/geoserver/cite/ows';
var defaultParameters = {
    service : 'WFS', //
    version : '1.1.0',
    request : 'GetFeature',
    transparent: true,
    typeName : 'cite:shape',
    outputFormat : 'application/json; subtype=json/spatial',
    SrsName : 'EPSG:4326'
};
var parameters = L.Util.extend(defaultParameters);
var URL = owsrootUrl + L.Util.getParamString(parameters);
var ajax = $.ajax({
    url : URL,
    success : function (response) {

        data3 = response
        dataAux = response

        geojsonLayer = newGeoJsonLayer(response).addTo(map);
    }
});
// #endregion

// #region Create GeoJson Layer
function newGeoJsonLayer(data) {
    return L.geoJson(data, {
      style: function (feature) {
        return {
          fillColor: currentColor === 'minus' ? getColorMinus(feature.properties[0]) : getColorMore(feature.properties[0]),
          fillOpacity: 0.9,
          stroke: false
        }
      },
      crs: L.CRS.EPSG4326,
      onEachFeature: onEachFeature
    })
  }

  function onEachFeature(feature, layer) {
    var popupContent = "<p>" +
      " Valor: " +
      feature.properties[0] +
      "</p>";
  
    layer.bindPopup(popupContent);
  }
// #endregion

// #region Delete GeoJson Layer
function cleanMap() {
  map.removeLayer(geojsonLayer)
  geojsonLayer = null
}
// #enregion

// #region Color Ramp
function getColorMinus(d) {
  return d > 293 ? '#7a0403' :
    d > 289 ? '#a21201' :
      d > 286 ? '#c52603' :
        d > 283 ? '#e04008' :
          d > 280 ? '#f26014' :
            d > 276 ? '#fc8825' :
              d > 273 ? '#fdae35' :
                d > 270 ? '#f0cc3a' :
                  d > 267 ? '#d7e535' :
                    d > 263 ? '#b6f735' :
                      d > 260 ? '#90ff48' :
                        d > 257 ? '#5cfc70' :
                          d > 253 ? '#2df09d' :
                            d > 250 ? '#18dec0' :
                              d > 247 ? '#23c4e3' :
                                d > 244 ? '#3aa3fc' :
                                  d > 240 ? '#4681f7' :
                                    d > 237 ? '#455ed3' :
                                      '#3e3994';
}

function getColorMore(d) {
  return d > 295 ? '#a81501' :
    d > 294 ? '#b71d02' :
      d > 293 ? '#c32503' :
        d > 291 ? '#cf2e04' :
          d > 290 ? '#d93807' :
            d > 289 ? '#e2430a' :
              d > 288 ? '#ea4e0d' :
                d > 286 ? '#f05b12' :
                  d > 285 ? '#f56a18' :
                    d > 284 ? '#fa7a1f' :
                      d > 282 ? '#fd8a26' :
                        d > 281 ? '#fe992c' :
                          d > 280 ? '#fea832' :
                            d > 279 ? '#fbb537' :
                              d > 277 ? '#f7c03a' :
                                d > 276 ? '#f1cb3a' :
                                  d > 275 ? '#e8d639' :
                                    d > 274 ? '#dedf37' :
                                      d > 272 ? '#d3e835' :
                                        d > 271 ? '#c6f034' :
                                          d > 270 ? '#b9f635' :
                                            d > 269 ? '#abfb38' :
                                              d > 267 ? '#9dfe40' :
                                                d > 266 ? '#8cff4b' :
                                                  d > 265 ? '#79fe59' :
                                                    d > 264 ? '#64fd6a' :
                                                      d > 261 ? '#50f97c' :
                                                        d > 260 ? '#3df58d' :
                                                          d > 258 ? '#2cf09e' :
                                                            d > 257 ? '#20eaad' :
                                                              d > 256 ? '#19e3ba' :
                                                                d > 253 ? '#18dac7' :
                                                                  d > 252 ? '#1bd0d5' :
                                                                    d > 251 ? '#22c5e2' :
                                                                      d > 250 ? '#2bb8ef' :
                                                                        d > 248 ? '#34acf8' :
                                                                          d > 247 ? '#3d9efe' :
                                                                            d > 246 ? '#4391fe' :
                                                                              d > 245 ? '#4684fa' :
                                                                                d > 243 ? '#4777ef' :
                                                                                  d > 242 ? '#466ae1' :
                                                                                    d > 241 ? '#455ccf' :
                                                                                      d > 239 ? '#434eb9' :
                                                                                        d > 238 ? '#403fa0' :
                                                                                          d > 237 ? '#3b3083' :
                                                                                            d > 236 ? '#362261' :
                                                                                              '#30123b';
}
// #endregion


