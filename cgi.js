if(!"L" in document) {
    console.error("Leaflet JS must be loaded"); 
}

var L = L||{}, cgi = cgi||{}; 

L.CGI = {};

// Button class
L.CGI.Button = L.Control.extend({
    initialize: function() {
        for(var k in arguments[0])
            this[k] = arguments[0][k];
    },
    options: {
        position: 'topleft'
    },
    onAdd: function (map) {
        var button = L.DomUtil.create('input');
        button.id = "btn-"+this.controller;
        button.type = "button";
        button.title = this.title;
        button.value = this.value;

        button.style.backgroundColor = 'white';     
        button.style.backgroundSize = "50px 30px";
        button.style.width = '50px';
        button.style.height = '30px';
    
        button.onclick = function(e){
            e.cancelBubble = true;
            cgi[this.controller].initialize(
                this.map, 
                this.opts
            );  
        }.bind(this);

        return button;
    }
});

// Object extension sugar/helper
cgi.extend = function(proto, literal) {
    var result = Object.create(proto);
    Object.keys(literal).forEach(function(key) {
        result[key] = literal[key];
    });
    return result;
}

// "Base"object, shared properties and methods for both ruler types
cgi.ruler = {
    map: null,
    labels: [],

    // Constructor
    initialize: function (map, options) {
        if(this[this.p] != null) {
            this.reset();
            return;
        }
        
        this.map = map;
        this[this.p] = L[this.p]([], 
            options).addTo(map);
        cgi.map.on("click", 
            this.onClick, this);

        document.getElementById(
            "btn-"+(this.p=="polyline"?"line":"area")+"Ruler")
            .style.fontWeight = "bold";
    },

    // Mouse movement event handler
    onMove: function (e) {
        this.updNode(-1, e.latlng, 1);
        // update label
        var n = this.labels.length-1;
        this.labels[n]
           .setLatLng(e.latlng)
           ._icon.innerHTML = this.getLabelValue(e.latlng);
    },

    // Double click event handler
    onDblClick: function() {
        // If user dblclicks, close the polygon
        this.map
            .off("mousemove", this.onMove, this)
            .off("dblclick", this.onDblClick, this)
            .off("click", this.onClick, this)
            .on("click", function (e) { 
                 cgi.map.doubleClickZoom.enable();
            });

        if(this.p == "polygon")
            this.map
                .on("click", this.isPointInPolygon, this);        
    },

    // Get number of polyline nodes
    numNodes: function() {
        return this[this.p]._latlngs.length;
    },

    // Insert or remove a polyline node
    updNode: function(position, latlng, numDelete) {
        var numDelete = numDelete||0;
        this[this.p].spliceLatLngs(
            position, numDelete, latlng
        );
    },

    // Add label marker to map
    addLabel: function (latlng) {
        return L.marker(latlng, 
            {icon: L.divIcon({
                iconSize: 0, 
                className: "distance-number-label"
            }),
            }).addTo(this.map);
    },

    // Remove shape object from map
    reset: function () {
        // Remove lines
        this.map.removeLayer(this[this.p]);
        this[this.p] = null;
        this.map.off("click", this.onClick, this);
        if("undefined" !== typeof this.isPointInPolygon) {
            document.getElementById("btn-areaRuler")
                .style.backgroundColor = "#fff";
            this.map.off("click", 
                this.isPointInPolygon, this);
        }
        // Remove labels
        for(var i=this.labels.length;i--;)
            this.map.removeLayer(this.labels[i]);
        this.labels.length = 0;
        if("distance" in this)
            this.distance = 0;
        if("circle" in this 
        && this.circle != null) {
            this.map.removeLayer(this.circle);
            this.circle = null;
        }
        document.getElementById(
            "btn-"+(this.p=="polyline"?"line":"area")+"Ruler")
            .style.fontWeight = "normal";
    }
}

// Line ruler controller object
cgi.lineRuler = cgi.extend(cgi.ruler, {
    p: "polyline",
    polyline: null,
    labels: [],
    distance: 0,

    // click adds new node
    onClick: function (e) {
        cgi.map.doubleClickZoom.disable();
        // Add new node
        this.updNode(-1, e.latlng);

        this.setDistance(e.latlng);
        this.labels.push(this.addLabel(e.latlng));

        // If first node then init
        if(this.numNodes() < 2) {
            this.updNode(-1, e.latlng);
            cgi.map
                .on("mousemove", this.onMove, this)
                .on("dblclick", this.onDblClick, this);
            this.labels.push(
                this.addLabel(e.latlng));
        }
    },

    // Get distance as string 
    getLabelValue: function (latlng) {
        return (this.getDistance(latlng) + this.distance).toFixed(2) + "m";
    }, 
    
    // Calculate distance 
    setDistance: function (latlng) {
        this.distance += this.getDistance(latlng);
    },

    // Distance calculator
    getDistance: function (latlng) {
        var n = this.labels.length-1;
        return n < 1 ? 0 : 
            +(this.labels[n-1]
                .getLatLng()
                .distanceTo(latlng)
                .toFixed(2));
    }
});

// Controller object of the area measuring example
cgi.areaRuler = cgi.extend(cgi.ruler, {
    p: "polygon",
    polygon: null,
    circle: null,

    // Click event handler
    onClick: function(e) {
        cgi.map.doubleClickZoom.disable();
        // Close polygon if click occurs 
        // in the vicinity of first point
        var ll = this.polygon._latlngs;
        if(ll.length > 0 &&
        this.ll2px(e.latlng).distanceTo(
        this.ll2px(ll[0])) < 10) {
            if(ll.length < 3) 
                this.reset();
            else
                cgi.map.fire("dblclick");
            return;
        }
        // else Add new point
        this.updNode(-1, e.latlng);

        // If first node then init
        if(this.numNodes() < 2) {
            this.circle = L.circleMarker(e.latlng)
                .addTo(cgi.map);
            this.updNode(-1, e.latlng);
            cgi.map
                .on("mousemove", 
                    this.onMove, this)
                .on("dblclick", 
                    this.onDblClick, this);
            this.labels.push(
                this.addLabel(e.latlng));
        }
    },

    // Calculate polygon area
    getLabelValue: function (latlng) {
        return this.calcArea().toFixed(2)+"m";
    },

    // Polygon area calculator 
    // using L.GeometryUtil plugin
    calcArea: function () {
        return L.GeometryUtil.geodesicArea(
            this.polygon.getLatLngs());
    },


    // latlong to pixels converter
    ll2px: function (latlng) {
        return this.map.latLngToLayerPoint(latlng);
    },

    // Test if user clicked on polygon
    isPointInPolygon: function(e) {
        var xy = this.ll2px(e.latlng),
            ll = this.polygon._latlngs,
            vs = [];
        for(var i = 0,n=ll.length;i<n;i++) {
            vs.push([
                this.ll2px(ll[i]).x,
                this.ll2px(ll[i]).y
            ]);
        }
        document.getElementById("btn-areaRuler")
            .style.backgroundColor = this.pointInPolygon([
                 xy.x,xy.y], vs) ? "#0f0" : "#f00";
    },

    // Test if user clicked on polygon. 
    // Credits: https://github.com/substack/point-in-polygon/blob/master/index.js
    pointInPolygon: function (point, vs) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        var x = point[0], y = point[1];
        var inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            var xi = vs[i][0], yi = vs[i][1];
            var xj = vs[j][0], yj = vs[j][1];
        
            var intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
    
        return inside;
    }
})
