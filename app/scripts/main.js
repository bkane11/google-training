var map, geocoder, autocomplete, distanceMatrix, directionsDisplay, directionsService,
	storesReady,
	directionsLayers = [],
	stores = [],
	closestStores,
	closestNumber = 5;

function initialize() {
  var mapOptions = {
    zoom: 6,
    center:  new google.maps.LatLng(60, 105),
  };
  geocoder = new google.maps.Geocoder();
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  locate('init');
  geocodeStores();
  // addStoresByLatLng();

  autocomplete = new google.maps.places.Autocomplete($('input.location')[0]);
  autocomplete.bindTo('bounds', map);
  google.maps.event.addListener(autocomplete, 'place_changed', onPlaceChanged);
  distanceMatrix = new google.maps.DistanceMatrixService();
  directionsService = new google.maps.DirectionsService();
}

function getDrivingDistance(start, end, cb){
	showLoading();
	hideLayers(directionsLayers);
	directionsLayers = [];
	end = stores.map(function(a){return $(a.info)[1].innerText});
	distanceMatrix.getDistanceMatrix(
	  {
	    origins: [start],
	    destinations: end instanceof Array ? end : [end],
	    travelMode: google.maps.TravelMode.DRIVING,
	    unitSystem: google.maps.UnitSystem.IMPERIAL,
	    durationInTraffic: false,
	    avoidHighways: false,
	    avoidTolls: false
	  }, cb
	 );
}

function handleDistanceMatrixResult(response, status){
	if (status != google.maps.DistanceMatrixStatus.OK) {
    alert('Error was: ' + status);
  } else {
    var origins = response.originAddresses;
    var destinations = response.destinationAddresses

    for (var i = 0; i < origins.length; i++) {
      var results = response.rows[i].elements;
      var closest = results.slice(0) // clone first
      	.sort(function(a,b){
	      	  if (a.distance.value < b.distance.value) {
			    return -1;
			  }
			  if (a.distance.value > b.distance.value) {
			    return 1;
			  }
			  return 0;
	      })
      	.slice(0, closestNumber) // return only the closest;
   	  var addresses = closest.map(function(a){
   	  	// calcRoute(origins[0], destinations[results.indexOf(a)]);
   	  	return [destinations[results.indexOf(a)], a]
   	  })

   	  getClosest(addresses, origins[0]);
    }
  }
}


function showLayers(group){
	if((!group || (group && group===stores) ) && !storesReady)
		return alert('Oops, stores are still loading.  Google\'s geocoding api did not allow the results to load this fast');
	group = group || stores;
	
	if(!group instanceof Array || !group.length)
		group = [group]

	group.forEach(function(layer){
		layer.setMap(map);
		// layer.setVisible(true);
	})
	$('.showStores').removeClass('show');
	return group
}

function hideLayers(group){
	group = group || stores
	group.forEach(function(layer){
		layer.setMap(null);
	})
	$('.showStores').addClass('show');
	return group
}

function addStoresByLatLng(){
	addresses.features.forEach(function(store){
		addMarker(new google.maps.LatLng(store.latlng[0], store.latlng[1]), ['<h5>'+(store.name || 'unknown')+ '</h5>', '<span>' + (store.address|| store) + '</span>'].join(''), stores);
	})
}

function geocodeStores(n){
	n = n || 0;
	if(n>addresses.features.length) return
	var store = addresses.features[n];
	if(!store) return
	showLoading('loading... store ' + n + ' of ' + addresses.features.length);
	codeAddress(store, addMarker, n, stores);
}

function codeAddress(store, cb, n, stores) {
  geocoder.geocode( { 'address': store.address || store}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
    	cb(results[0].geometry.location, ['<h5>'+(store.name || 'unknown')+ '</h5>', '<span>' + (store.address|| store) + '</span>'].join(''), stores );    	
    	if(n>=0)
	    	setTimeout( function(){
	    		geocodeStores(n+1, stores);
	    	 }, 300);
    } else {
      console.log('Geocode was not successful for the following reason: ' + status);
	      setTimeout( function(){
	    		codeAddress(store, cb, n, stores);
	       }, 1000);
    }
  });
}

function getClosest(locations, origin){
	var closest = [];
	hideLayers(stores);
	if(locations instanceof Array || typeof locations==='string')
		locations.forEach(function(location, l_index){
			var distanceInfo = location[1];
			location = location[0];
			stores.forEach(function(store, s_index){
				var info = $(store.info),
					addressNumLocation = location.split(' ')[0].trim(),
					addressNumStore = info[1].innerText.split(' ')[0].trim(),
					storeParts = info[1].innerText.split(','),
					locationParts = location.split(',');
				if(addressNumStore === addressNumLocation  && locationParts[locationParts.length-2].trim() == storeParts[storeParts.length-1].trim() )
					closest.push([store, distanceInfo]),
					calcRoute(origin, info[1].innerText, store);
			})
		})
	else
		return getDrivingDistance(map.getCenter(), stores, handleDistanceMatrixResult)

	$('ul.closest').empty();
	closestStores = closest
		.slice(0,closestNumber)
		.forEach(function(item){
			var marker = item[0], itemInfo = item[1];
			if(!marker) return
			var info =  $(marker.info);
			var item = $('<li></li>')
				.on('click', function(){
					showInfoWindow(marker, marker.info );
					hideLayers(directionsLayers);
					var currentCenter;
					if(marker.directions)
						showLayers([marker, marker.directions]),
						marker.directions.setPanel( $('#directions').empty()[0] ),
						currentCenter = map.getCenter(),
						$('.cansplit:not(.split)').addClass('split'),
						map.getCenter(currentCenter),
						showDirectionsButton() // recenter the map after panel split
				})
				.html( info.append('<i>' + ['',itemInfo.distance.text, itemInfo.duration.text].join('<br/>') + '</i>').html() )
				.attr('title', info[1].innerText )
				.appendTo('ul.closest');
			return marker.setMap(map);
		});
}

var meMarker;

function markMe(pos){
	var icon = 'https://chart.googleapis.com/chart?chst=d_map_spin&chld=0.5|0|FFFF42|10|b|ME';
	!meMarker ? meMarker = new google.maps.Marker({
	      position: pos,
	      map: map,
	      zIndex: 999,
	      visible: true,
	      icon: icon
	}) : meMarker.setPosition(pos);
}

function setCenter(position, init){
	var pos = position.coords ? new google.maps.LatLng(position.coords.latitude, position.coords.longitude) : position;
	map.setCenter(pos);
	markMe(pos);
	if(init!=='init')
		getClosest(pos);
}

function showInfoWindow(marker, info){
     var options = {
        map: map,
        position: marker.position,
        content: info || marker.info  || 'Right here.'
      };
      if(map.infowindow) 
      	map.infowindow.close(),
		map.infowindow.setOptions(options)
  	  else
  	  	map.infowindow = new google.maps.InfoWindow(options);
}

function addMarker(latlng, info, stores){
	  var marker = new google.maps.Marker({
	      position: latlng,
	      info: info
	  });
	  google.maps.event.addListener(marker, 'click', function() {
	    showInfoWindow(marker);
	  });

	  if(stores){
		  if(stores.length<addresses.features.length)
			  stores.push(marker);
		  if(stores.length===addresses.features.length)
		  		storesReady = true,
		  		hideLoading(),
		 		displayShowStoresButton();
	  }else
	  	console.log('no stores');
}

function displayShowStoresButton(){
	$('.showStores')
		.removeClass('hidden')
		.off('click')
		.on('click', function(){
			if($(this).hasClass('show'))
				showLayers(stores)
			else
				hideLayers([].concat(directionsLayers,stores)) 
		})
}
function showDirectionsButton(){
	var currentCenter;
	$('.showDirections')
		.removeClass('hidden')
		.off('click')
		.on('click', function(){
			if($(this).hasClass('show'))
				showLayers(directionsLayers)
			else
				hideLayers([].concat(directionsLayers,closestStores || [] )),
				$(this).addClass('hidden'),
				currentCenter = map.getCenter(),
				clearResults()
				map.getCenter(currentCenter)
		})
}

function clearResults(){
	$('#directions').empty();
	$('.split').removeClass('split');
}

function hideLoading(){
	$('.loading').fadeOut();
}
function showLoading(html){
	$('.loading').html(html || 'loading...').fadeIn();
}

function locate(e){
	  if(navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition(
	    	function(result){setCenter(result, e)},
	    	function() { 
		      handleNoGeolocation(true);
		 });
	  	} else {
	    // Browser doesn't support Geolocation
	    handleNoGeolocation(false);
	}
}

$('.locate').on('click', locate);

function handleNoGeolocation(errorFlag) {
  if (errorFlag) {
    var content = 'Error: The Geolocation service failed.';
  } else {
    var content = 'Error: Your browser doesn\'t support geolocation.';
  }

  var options = {
    map: map,
    position: new google.maps.LatLng(60, 105),
    content: content
  };
  // var infowindow = new google.maps.InfoWindow(options);
  map.setCenter(options.position);
}

// google.maps.event.addDomListener(window, 'load', initialize);
function loadScript() {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://maps.googleapis.com/maps/api/js?libraries=geometry,places&v=3.exp&sensor=true&' +
      'callback=initialize';
  document.body.appendChild(script);
}

function onPlaceChanged(e) {
    if(map.infowindow)
	    map.infowindow.close();
    var place = autocomplete.getPlace();
    if (!place.geometry) {
      return;
    }

    // If the place has a geometry, then present it on a map.
    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(14);  // Why 17? Because it looks good.
    }

    clearResults();
    markMe(map.getCenter())
    getDrivingDistance(map.getCenter(), stores, handleDistanceMatrixResult)
    // getClosest(map.getCenter());
  }

function calcRoute(start, end, marker) {
  var request = {
      origin:start,
      destination:end,
      travelMode: google.maps.TravelMode.DRIVING
  };

  var rendererOptions = {
  	// suppressInfoWindows: true,
  	suppressMarkers: true
  }

  var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
  directionsDisplay.setMap(map);

  marker.setMap(map);
  marker.setVisible(true);
  marker.directions = directionsDisplay;
  
  directionsLayers.push(directionsDisplay);
  directionsService.route(request, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(response);
    }else{
    	console.log('routing failed:', status, 'for', start, 'to', end);
    }
  });

  showDirectionsButton();
  hideLoading();
}


window.onload = loadScript;