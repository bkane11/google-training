var map, geocoder, autocomplete, distanceMatrix
	storesReady,
	stores = []
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

  autocomplete = new google.maps.places.Autocomplete($('input.location')[0]);
  autocomplete.bindTo('bounds', map);
  google.maps.event.addListener(autocomplete, 'place_changed', onPlaceChanged);
  distanceMatrix = new google.maps.DistanceMatrixService();
}

function getDrivingDistance(start, end, cb){
	distanceMatrix.getDistanceMatrix(
  {
    origins: [start],
    destinations: [end],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
    durationInTraffic: false,
    avoidHighways: false,
    avoidTolls: false
  }, cb);
}

function showAllStores(){
	if(!storesReady)
		return alert('Oops, stores are still loading.  Google\'s geocoding api did not allow the results to load this fast');
	stores.forEach(function(store){
		console.log(store);
		store.setVisible(true);
	})
}

function hideAllStores(){
	stores.forEach(function(store){
		store.setVisible(false);
	})
}

function updateLoadingInfo(html){
	$('.loadingInfo').html(html)
}

function geocodeStores(n){
	n = n || 0;
	if(n>addresses.features.length) return
	var store = addresses.features[n];
	if(!store) return
	updateLoadingInfo('loading store ' + n + ' of ' + addresses.features.length)
	codeAddress(store, addMarker, n);
}

function codeAddress(store, cb, n) {
  geocoder.geocode( { 'address': store.address}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
    	cb(results[0].geometry.location, ['<h5>'+store.name+ '</h5>', store.address].join('') );
    	setTimeout( function(){
    		geocodeStores(n+1);
    	 }, 300);
    } else {
      console.log('Geocode was not successful for the following reason: ' + status);
      setTimeout( function(){
    		codeAddress(store, cb, n);
       }, 1000);
    }
  });
}

function getClosest(location){
	var closest = [];
	stores.forEach(function(store){
		if(store.position)
			closest.push([store, google.maps.geometry.spherical.computeDistanceBetween(location, store.position)]);//, radius?:number)
	})

	$('ul.closest').empty();
	return closest.sort(function(a,b){return a[1] - b[1]}).slice(0,closestNumber)
		.forEach(function(marker){
			marker[0].setVisible(true);
			var info =  $(marker[0].info);
			var item = $('<li></li>').html(marker[0].info)
				.on('click', function(){showInfoWindow(marker[0], info.find('h5').remove() )})
				.attr('title', info[0].innerText)
				.appendTo('ul.closest')
		});
}

function setCenter(position){
	var pos = position.coords ? new google.maps.LatLng(position.coords.latitude, position.coords.longitude) : position;
	map.setCenter(pos);
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

function addMarker(latlng, info){
	  // var image = 'images/beachflag.png';
	  var marker = new google.maps.Marker({
	      position: latlng,
	      map: map,
	      visible: false,
	      info: info
	      // icon: image
	  });
	  google.maps.event.addListener(marker, 'click', function() {
	    showInfoWindow(marker);
	  });
	  // console.log(marker);
	  stores.push(marker);
	  if(stores.length===addresses.features.length)
	  		storesReady = true,
	  		hideLoading(),
	 		displayShowStoresButton();
}

function displayShowStoresButton(){
	$('.showStores')
		.off('click')
		.on('click', showAllStores)
		.removeClass('hidden');
}

function hideLoading(){
	$('.title').removeClass('loading');
	updateLoadingInfo('');
}
function showLoading(){
	$('.title').addClass('loading');
}

function locate(e){
	  if(navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition(
	    	setCenter,
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

    getClosest(map.getCenter());
  }


window.onload = loadScript;