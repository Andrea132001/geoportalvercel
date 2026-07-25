var CAPAS_CONFIG=[
    {
        tabla:'cantones_lahar1',
        nombre:'Cantones',
        descripcion:'Limites cantonales',
        color:'#8B7355',
        tipo:'polygon',
        peso:1.8,
        fillOpacidad:0.06,
        bordeOpacidad:0.7,
        dashArray:'8 4',
        camposMostrar:['can_descri','pro_descri','region'],
        camposLabels:{can_descri:'Canton',pro_descri:'Provincia',region:'Region'}
    },
    {
        tabla:'lahar_cotopaxi4326',
        nombre:'Zona de Lahar',
        descripcion:'Cuenca de amenaza volcanica',
        color:'#dc3545',
        tipo:'polygon',
        peso:1.5,
        fillOpacidad:0.18,
        bordeOpacidad:0.85,
        dashArray:'',
        camposMostrar:['descrip','volcan','nivel'],
        camposLabels:{descrip:'Descripcion',volcan:'Volcan',nivel:'Nivel de Amenaza'}
    },
    {
        tabla:'pueblos_area_estudio',
        nombre:'Pueblos',
        descripcion:'Centros poblados',
        color:'#16a34a',
        tipo:'polygon',
        peso:1.5,
        fillOpacidad:0.30,
        bordeOpacidad:0.9,
        dashArray:'',
        camposMostrar:['nombre','desc_cant','desc_prov'],
        camposLabels:{nombre:'Nombre',desc_cant:'Canton',desc_prov:'Provincia'}
    },
    {
        tabla:'red_hidrica_area_estudio',
        nombre:'Red Hidrica',
        descripcion:'Rios y quebradas',
        color:'#0284c7',
        tipo:'line',
        peso:2,
        fillOpacidad:0,
        bordeOpacidad:0.85,
        dashArray:'',
        camposMostrar:['nombres','length'],
        camposLabels:{nombres:'Nombre',length:'Longitud (m)'}
    },
    {
        tabla:'vias_area_estudio',
        nombre:'Vias de Acceso',
        descripcion:'Caminos y carreteras',
        color:'#475569',
        tipo:'line',
        peso:2.5,
        fillOpacidad:0,
        bordeOpacidad:0.9,
        dashArray:'',
        camposMostrar:['layer','length'],
        camposLabels:{layer:'Nombre',length:'Longitud (m)'}
    }
];

var map=L.map('map',{center:[-0.68,-78.44],zoom:11,zoomControl:false});

L.control.zoom({position:'topright'}).addTo(map);

var basemapClaro=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'CARTO | OSM',maxZoom:19});
var basemapSatelital=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri',maxZoom:19});
var basemapOscuro=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'CARTO | OSM',maxZoom:19});
basemapClaro.addTo(map);
var basemapActual='claro';

function cambiarBasemap(tipo){
    if(tipo===basemapActual)return;
    map.removeLayer(basemapActual==='claro'?basemapClaro:basemapActual==='satelital'?basemapSatelital:basemapOscuro);
    if(tipo==='claro')basemapClaro.addTo(map);
    else if(tipo==='satelital')basemapSatelital.addTo(map);
    else basemapOscuro.addTo(map);
    basemapActual=tipo;
    document.querySelectorAll('.basemap-btn').forEach(function(b){b.classList.remove('active');if(b.getAttribute('data-basemap')===tipo)b.classList.add('active');});
}

var capasCargadas={};
var totalFeatures=0;
var totalErrores=0;
var syncFromLeaflet=false;
capaReportes=L.layerGroup();
capaExposicion=L.layerGroup();

var popupsGuardados=new Map();

function _deshabilitarCapa(l){
    if(l._popup){
        popupsGuardados.set(l,l._popup.getContent());
        l.closePopup();
        l.unbindPopup();
    }
}

function _habilitarCapa(l){
    if(popupsGuardados.has(l)){
        l.bindPopup(popupsGuardados.get(l),{maxWidth:280,maxHeight:220});
        popupsGuardados.delete(l);
    }
}

function desactivarInteractividadCapas(){
    Object.values(capasCargadas).forEach(function(c){
        if(c&&c.eachLayer)c.eachLayer(_deshabilitarCapa);
    });
    [capaReportes,capaExposicion].forEach(function(grupo){
        if(grupo&&grupo.eachLayer)grupo.eachLayer(_deshabilitarCapa);
    });
}

function restaurarInteractividadCapas(){
    Object.values(capasCargadas).forEach(function(c){
        if(c&&c.eachLayer)c.eachLayer(_habilitarCapa);
    });
    [capaReportes,capaExposicion].forEach(function(grupo){
        if(grupo&&grupo.eachLayer)grupo.eachLayer(_habilitarCapa);
    });
    popupsGuardados.clear();
}

function actualizarResumen(){
    var capasVisibles=0;
    var featuresVisibles=0;
    Object.values(capasCargadas).forEach(function(c){
        if(c&&map.hasLayer(c)){
            capasVisibles++;
            if(c.eachLayer){
                var count=0;
                c.eachLayer(function(){count++;});
                featuresVisibles+=count;
            }
        }
    });
    if(map.hasLayer(capaReportes)){
        capasVisibles++;
        var countR=0;
        capaReportes.eachLayer(function(){countR++;});
        featuresVisibles+=countR;
    }
    if(map.hasLayer(capaExposicion)){
        capasVisibles++;
        var countE=0;
        capaExposicion.eachLayer(function(){countE++;});
        featuresVisibles+=countE;
    }
    var elF=document.getElementById('stat-features');
    var elC=document.getElementById('stat-capas');
    var elT=document.getElementById('stat-tablas');
    if(elF)elF.textContent=featuresVisibles;
    if(elC)elC.textContent=capasVisibles;
    if(elT)elT.textContent=CAPAS_CONFIG.length;
}

function inicializarUI(){
    var capasPanel=document.getElementById('capas-panel-list');
    var leyenda=document.getElementById('legend-content');
    if(capasPanel)capasPanel.innerHTML='';
    if(leyenda)leyenda.innerHTML='';

    CAPAS_CONFIG.forEach(function(c,i){
        var item=document.createElement('div');
        item.className='capa-item';
        var swatch=c.tipo==='polygon'
            ?'<div class="capa-swatch" style="border-color:'+c.color+'"></div>'
            :'<div class="capa-swatch capa-swatch-line" style="background:'+c.color+'"></div>';
        item.innerHTML=swatch+'<div class="capa-info"><div class="capa-nombre">'+c.nombre+'</div><div class="capa-desc">'+c.descripcion+'</div></div><label class="capa-switch"><input type="checkbox" class="capa-toggle" checked data-index="'+i+'"/><span class="capa-slider"></span></label>';
        if(capasPanel)capasPanel.appendChild(item);

        var legendItem=document.createElement('div');
        legendItem.className='legend-item';
        if(c.tipo==='polygon'){
            legendItem.innerHTML='<div class="legend-symbol legend-poly" style="border-color:'+c.color+'"></div><span>'+c.nombre+'</span>';
        }else{
            legendItem.innerHTML='<div class="legend-symbol legend-line" style="background:'+c.color+'"></div><span>'+c.nombre+'</span>';
        }
        if(leyenda)leyenda.appendChild(legendItem);
    });

    var repItem=document.createElement('div');
    repItem.className='capa-item';
    repItem.innerHTML='<div class="capa-swatch" style="border-color:#ef4444"></div><div class="capa-info"><div class="capa-nombre">Reportes Ciudadanos</div><div class="capa-desc">Reportes de problemas</div></div><label class="capa-switch"><input type="checkbox" class="capa-toggle" checked id="toggle-rep"/><span class="capa-slider"></span></label>';
    if(capasPanel)capasPanel.appendChild(repItem);

    var repLegend=document.createElement('div');
    repLegend.className='legend-item';
    repLegend.innerHTML='<div class="legend-symbol legend-poly" style="border-color:#ef4444"></div><span>Reportes Ciudadanos</span>';
    if(leyenda)leyenda.appendChild(repLegend);

    var expItem=document.createElement('div');
    expItem.className='capa-item';
    expItem.innerHTML='<div class="capa-swatch" style="border-color:#f59e0b"></div><div class="capa-info"><div class="capa-nombre">Reportes Exposicion</div><div class="capa-desc">Eventos de amenaza</div></div><label class="capa-switch"><input type="checkbox" class="capa-toggle" checked id="toggle-exp"/><span class="capa-slider"></span></label>';
    if(capasPanel)capasPanel.appendChild(expItem);

    var expLegend=document.createElement('div');
    expLegend.className='legend-item';
    expLegend.innerHTML='<div class="legend-symbol legend-poly" style="border-color:#f59e0b"></div><span>Reportes Exposicion</span>';
    if(leyenda)leyenda.appendChild(expLegend);

    document.querySelectorAll('.capa-toggle').forEach(function(cb){
        cb.addEventListener('change',function(){
            if(syncFromLeaflet)return;
            syncFromLeaflet=true;
            var idx=this.getAttribute('data-index');
            if(idx!==null&&idx!==undefined){
                idx=parseInt(idx);
                var config=CAPAS_CONFIG[idx];
                if(this.checked&&capasCargadas[config.tabla])capasCargadas[config.tabla].addTo(map);
                else if(!this.checked&&capasCargadas[config.tabla])map.removeLayer(capasCargadas[config.tabla]);
            }else if(this.id==='toggle-rep'){
                if(this.checked)capaReportes.addTo(map);else map.removeLayer(capaReportes);
            }else if(this.id==='toggle-exp'){
                if(this.checked)capaExposicion.addTo(map);else map.removeLayer(capaExposicion);
            }
            syncFromLeaflet=false;
            actualizarResumen();
        });
    });

    document.querySelectorAll('.basemap-btn').forEach(function(btn){
        btn.addEventListener('click',function(){cambiarBasemap(this.getAttribute('data-basemap'));});
    });
}

function construirPopup(propiedades,camposMostrar,camposLabels,nombreCapa,color){
    var sH='padding:12px 14px 10px;border-bottom:1px solid #edf0f4;font-family:Inter,sans-serif;';
    var sB='padding:8px 14px 12px;font-family:Inter,sans-serif;';
    var sR='display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;';
    var sL='font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.3px;font-family:Inter,sans-serif;';
    var sV='color:#1a1a2e;font-size:12px;font-weight:500;text-align:right;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:Inter,sans-serif;';

    var html='<div style="'+sH+'"><span style="font-size:14px;font-weight:700;color:'+color+';">'+nombreCapa+'</span></div><div style="'+sB+'">';
    camposMostrar.forEach(function(campo){
        var valor=propiedades[campo];
        if(valor===null||valor===undefined||valor==='')return;
        var label=camposLabels[campo]||campo;
        if(typeof valor==='number')valor=Math.round(valor*100)/100;
        html+='<div style="'+sR+'"><span style="'+sL+'">'+label+'</span><span style="'+sV+'" title="'+valor+'">'+valor+'</span></div>';
    });
    html+='</div>';
    return html;
}

async function consultarCapa(config){
    var url=SUPABASE_URL+'/rest/v1/'+config.tabla+'?select=*';
    var response=await fetch(url,{headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY}});
    if(!response.ok)throw new Error('Error '+response.status+' en '+config.tabla);
    var datos=await response.json();
    if(!datos||datos.length===0)return null;

    var features=[];
    datos.forEach(function(reg){
        var geom=reg.geom||reg.geometry||reg.geojson;
        if(typeof geom==='string'){try{geom=JSON.parse(geom);}catch(e){}}
        if(geom&&geom.type){
            var props={};
            config.camposMostrar.forEach(function(c){if(reg[c]!==undefined&&reg[c]!==null)props[c]=reg[c];});
            features.push({type:'Feature',properties:props,geometry:geom});
        }
    });

    if(features.length===0)return null;
    var geojson={type:'FeatureCollection',features:features};
    var opciones={};
    if(config.tipo==='polygon'){
        opciones.style=function(){return{color:config.color,weight:config.peso,fillColor:config.color,fillOpacity:config.fillOpacidad,opacity:config.bordeOpacidad,dashArray:config.dashArray||null};};
    }else{
        opciones.style=function(){return{color:config.color,weight:config.peso,opacity:config.bordeOpacidad};};
    }
    opciones.onEachFeature=function(feature,layer){
        layer.bindPopup(construirPopup(feature.properties,config.camposMostrar,config.camposLabels,config.nombre,config.color),{maxWidth:280,maxHeight:220});
    };
    opciones.pointToLayer=function(feature,latlng){return L.circleMarker(latlng,{radius:5,fillColor:config.color,color:'#fff',weight:2,opacity:1,fillOpacity:0.8});};
    return{capa:L.geoJSON(geojson,opciones),total:features.length};
}

async function cargarTodasLasCapas(){
    var overlay=document.getElementById('loading-overlay');
    var statusBar=document.getElementById('status-bar');
    overlay.classList.remove('hidden');
    overlay.querySelector('.loading-sub').textContent='Conectando con Supabase...';

    Object.values(capasCargadas).forEach(function(c){map.removeLayer(c);});
    capasCargadas={};
    totalFeatures=0;
    totalErrores=0;

    capaReportes.addTo(map);
    capaExposicion.addTo(map);

    var grupo=L.featureGroup();
    var cargadas=0;

    for(var i=0;i<CAPAS_CONFIG.length;i++){
        var config=CAPAS_CONFIG[i];
        overlay.querySelector('.loading-sub').textContent=config.nombre+' ('+(i+1)+'/'+CAPAS_CONFIG.length+')';
        try{
            var resultado=await consultarCapa(config);
            if(resultado){
                resultado.capa.addTo(map);
                capasCargadas[config.tabla]=resultado.capa;
                resultado.capa.eachLayer(function(l){grupo.addLayer(l);});
                totalFeatures+=resultado.total;
                cargadas++;
                document.getElementById('stat-features').textContent=totalFeatures;
            }
        }catch(err){
            console.error('Error cargando '+config.tabla+':',err);
            totalErrores++;
            document.getElementById('stat-errores').textContent=totalErrores;
        }
    }

    actualizarResumen();
    if(grupo.getLayers().length>0)map.fitBounds(grupo.getBounds().pad(0.08));

    setTimeout(function(){overlay.classList.add('hidden');},600);

    if(totalErrores===0&&cargadas>0){
        statusBar.className='success';
        statusBar.innerHTML='&#10003; <b>'+cargadas+'</b> capas activas | <b>'+totalFeatures+'</b> features | <b>5</b> tablas | <b>0</b> errores';
    }else{
        statusBar.className='error';
        statusBar.innerHTML='&#9888; <b>'+cargadas+'</b> capas OK | <b>'+totalFeatures+'</b> features | <b>5</b> tablas | <b>'+totalErrores+'</b> errores';
    }
    setTimeout(function(){statusBar.className='';statusBar.textContent='';},6000);
}

var MAX_RESULTS=12;

function buscarFeatures(texto){
    var container=document.getElementById('feature-search-results');
    if(!container)return;
    if(!texto||texto.length<2){container.classList.remove('visible');return;}
    var busqueda=texto.toLowerCase();
    var resultados=[];

    CAPAS_CONFIG.forEach(function(config){
        var capa=capasCargadas[config.tabla];
        if(!capa)return;
        capa.eachLayer(function(layer){
            if(!layer.feature||!layer.feature.properties)return;
            var props=layer.feature.properties;
            var fields=config.camposMostrar;
            for(var f=0;f<fields.length;f++){
                var val=props[fields[f]];
                if(val&&String(val).toLowerCase().indexOf(busqueda)!==-1){
                    resultados.push({layer:layer,valor:String(val),campo:fields[f],color:config.color,capaNombre:config.nombre,config:config});
                    return;
                }
            }
        });
    });

    container.innerHTML='';
    if(resultados.length===0){
        container.innerHTML='<div class="buscador-result-empty">Sin resultados para "'+texto+'"</div>';
        container.classList.add('visible');
        return;
    }
    var total=resultados.length;
    var mostrar=resultados.slice(0,MAX_RESULTS);
    mostrar.forEach(function(r){
        var item=document.createElement('div');
        item.className='buscador-result-item';
        item.innerHTML='<div class="buscador-resultado-info"><div class="buscador-resultado-nombre">'+r.valor+'</div><div class="buscador-resultado-meta"><span class="buscador-resultado-tipo" style="color:'+r.color+'">'+r.capaNombre+'</span></div></div>';
        item.addEventListener('click',function(){
            seleccionarFeatureDeCapa(r.layer);
            container.classList.remove('visible');
        });
        container.appendChild(item);
    });
    if(total>MAX_RESULTS){
        var more=document.createElement('div');
        more.className='buscador-result-empty';
        more.textContent='... y '+(total-MAX_RESULTS)+' mas. Sigue escribiendo para filtrar.';
        container.appendChild(more);
    }
    container.classList.add('visible');
}

/* ===== REPORTES CIUDADANOS ===== */
var reporteUbicacion={lat:null,lng:null};
var seleccionandoUbicacion=false;
var marcadorTemporal=null;

/* ===== ESTOY EN AMENAZA ===== */
var consultandoAmenaza=false;
var marcadorAmenaza=null;
var amenazaResultData=null;

var COLORES_CATEGORIA={'Baches':'#f59e0b','Alumbrado':'#eab308','Basura':'#84cc16','Agua':'#06b6d4','Alcantarillado':'#0ea5e9','Parques':'#22c55e','Inundacion':'#3b82f6','Animales':'#a855f7','Seguridad':'#ef4444','Otro':'#6b7280'};
var ICONOS_CATEGORIA={'Baches':'&#128739;','Alumbrado':'&#128161;','Basura':'&#128465;','Agua':'&#128167;','Alcantarillado':'&#128167;','Parques':'&#127795;','Inundacion':'&#127754;','Animales':'&#128062;','Seguridad':'&#128680;','Otro':'&#9888;'};

function toggleFormularioReporte(){
    var collapse=document.getElementById('panel-reporte-collapse');
    var arrow=document.getElementById('toggle-arrow');
    if(collapse.classList.contains('abierto')){collapse.classList.remove('abierto');arrow.classList.remove('abierto');}
    else{collapse.classList.add('abierto');arrow.classList.add('abierto');}
}

function activarSeleccionUbicacion(){
    seleccionandoUbicacion=!seleccionandoUbicacion;
    var btn=document.getElementById('btn-ubicacion');
    var box=document.getElementById('rep-ubicacion');
    var contenedor=document.getElementById('map-container');
    if(seleccionandoUbicacion){
        desactivarInteractividadCapas();
        btn.classList.add('activo');btn.textContent='Cancelar seleccion';
        box.classList.add('seleccionando');box.classList.remove('ubicado');
        document.getElementById('rep-ubicacion-texto').textContent='Haz clic en el mapa para ubicar el problema';
        contenedor.classList.add('mapa-seleccionando');map.getContainer().style.cursor='crosshair';
    }else{
        restaurarInteractividadCapas();
        btn.classList.remove('activo');btn.textContent='Seleccionar ubicacion';
        box.classList.remove('seleccionando');
        contenedor.classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
    }
}

function usarMiUbicacion(){
    if(!navigator.geolocation){mostrarReporteMsg('error','Tu navegador no soporta geolocalizacion.');return;}
    var btn=document.getElementById('btn-mi-ubicacion');
    btn.disabled=true;btn.textContent='Obteniendo...';
    navigator.geolocation.getCurrentPosition(function(posicion){
        var lat=posicion.coords.latitude;var lng=posicion.coords.longitude;
        reporteUbicacion.lat=lat;reporteUbicacion.lng=lng;
        if(marcadorTemporal)map.removeLayer(marcadorTemporal);
        var icono=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#22c55e;">&#128205;</div>',iconSize:[28,28],iconAnchor:[14,14]});
        marcadorTemporal=L.marker([lat,lng],{icon:icono,draggable:true}).addTo(map);
        marcadorTemporal.on('dragend',function(e){
            var p=e.target.getLatLng();reporteUbicacion.lat=p.lat;reporteUbicacion.lng=p.lng;
            document.getElementById('rep-ubicacion-texto').innerHTML='&#10003; <b>'+p.lat.toFixed(6)+', '+p.lng.toFixed(6)+'<\/b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)<\/span>';
        });
        map.setView([lat,lng],14);
        var box=document.getElementById('rep-ubicacion');
        box.classList.add('ubicado');box.classList.remove('seleccionando');
        document.getElementById('rep-ubicacion-texto').innerHTML='&#10003; <b>'+lat.toFixed(6)+', '+lng.toFixed(6)+'<\/b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)<\/span>';
        btn.disabled=false;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg> Mi ubicacion';
        seleccionandoUbicacion=false;
        restaurarInteractividadCapas();
        document.getElementById('btn-ubicacion').classList.remove('activo');
        document.getElementById('btn-ubicacion').textContent='Seleccionar ubicacion';
        document.getElementById('map-container').classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
    },function(error){
        var msg='No se pudo obtener tu ubicacion.';
        if(error.code===1)msg='Permiso de ubicacion denegado.';
        else if(error.code===2)msg='Ubicacion no disponible.';
        else if(error.code===3)msg='Tiempo de espera agotado.';
        mostrarReporteMsg('error',msg);
        btn.disabled=false;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg> Mi ubicacion';
    },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

map.on('click',function(e){
    if(!seleccionandoUbicacion)return;
    reporteUbicacion.lat=e.latlng.lat;reporteUbicacion.lng=e.latlng.lng;
    if(marcadorTemporal)map.removeLayer(marcadorTemporal);
    var icono=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#ef4444;">&#128205;</div>',iconSize:[28,28],iconAnchor:[14,14]});
    marcadorTemporal=L.marker(e.latlng,{icon:icono,draggable:true}).addTo(map);
    marcadorTemporal.on('dragend',function(ev){
        var p=ev.target.getLatLng();reporteUbicacion.lat=p.lat;reporteUbicacion.lng=p.lng;
        document.getElementById('rep-ubicacion-texto').innerHTML='&#10003; <b>'+p.lat.toFixed(6)+', '+p.lng.toFixed(6)+'</b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)</span>';
    });
    var box=document.getElementById('rep-ubicacion');
    box.classList.add('ubicado');box.classList.remove('seleccionando');
    document.getElementById('rep-ubicacion-texto').innerHTML='&#10003; <b>'+e.latlng.lat.toFixed(6)+', '+e.latlng.lng.toFixed(6)+'</b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)</span>';
    seleccionandoUbicacion=false;
    restaurarInteractividadCapas();
    document.getElementById('btn-ubicacion').classList.remove('activo');
    document.getElementById('btn-ubicacion').textContent='Cambiar ubicacion';
    document.getElementById('map-container').classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
});

/* ===== ESTOY EN AMENAZA - FUNCIONES ===== */
function resetAmenazaTool(){
    consultandoAmenaza=false;
    amenazaResultData=null;
    restaurarInteractividadCapas();
    if(marcadorAmenaza){map.removeLayer(marcadorAmenaza);marcadorAmenaza=null;}
    var btn=document.getElementById('btn-amenaza-consultar');
    if(btn){
        btn.classList.remove('activo');
        btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Seleccionar ubicacion';
    }
    var geoBtn=document.getElementById('btn-amenaza-geo');
    if(geoBtn){geoBtn.disabled=false;geoBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg> Mi ubicacion';}
    var contenedor=document.getElementById('map-container');
    if(contenedor){contenedor.classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';}
    var resultado=document.getElementById('amenaza-resultado');
    if(resultado){
        resultado.innerHTML='<div class="amenaza-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>Haz clic en el mapa para consultar</span></div>';
    }
    var pdfBtn=document.getElementById('btn-amenaza-pdf');
    if(pdfBtn)pdfBtn.style.display='none';
}

function toggleAmenaza(){
    var collapse=document.getElementById('panel-amenaza-collapse');
    var arrow=document.getElementById('toggle-arrow-amenaza');
    if(collapse.classList.contains('abierto')){
        collapse.classList.remove('abierto');arrow.classList.remove('abierto');
        resetAmenazaTool();
    }else{
        collapse.classList.add('abierto');arrow.classList.add('abierto');
    }
}

function activarConsultaAmenaza(){
    consultandoAmenaza=!consultandoAmenaza;
    var btn=document.getElementById('btn-amenaza-consultar');
    var contenedor=document.getElementById('map-container');
    if(consultandoAmenaza){
        desactivarInteractividadCapas();
        btn.classList.add('activo');
        btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelar';
        contenedor.classList.add('mapa-seleccionando');map.getContainer().style.cursor='crosshair';
    }else{
        restaurarInteractividadCapas();
        resetAmenazaTool();
    }
}

function consultarAmenaza(lat,lon){
    var resultado=document.getElementById('amenaza-resultado');
    resultado.innerHTML='<div class="amenaza-estado cargando">Consultando...</div>';
    var pdfBtn=document.getElementById('btn-amenaza-pdf');
    if(pdfBtn)pdfBtn.style.display='none';

    fetch(SUPABASE_URL+'/rest/v1/rpc/consultar_ubicacion',{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':API_KEY,'Authorization':'Bearer '+API_KEY},
        body:JSON.stringify({lat:lat,lon:lon})
    })
    .then(function(resp){
        if(!resp.ok)throw new Error('Error del servidor: '+resp.status);
        return resp.json();
    })
    .then(function(data){
        if(!data||!data.length){
            resultado.innerHTML='<div class="amenaza-estado error">Sin resultados para esta ubicacion.</div>';
            return;
        }
        amenazaResultData=data[0];
        renderizarResultadoAmenaza(data[0]);
    })
    .catch(function(err){
        console.error('Error consultando amenaza:',err);
        resultado.innerHTML='<div class="amenaza-estado error">No se pudo completar la consulta. Verifica tu conexion e intenta de nuevo.</div>';
    });
}

function renderizarResultadoAmenaza(d){
    var resultado=document.getElementById('amenaza-resultado');
    var estadoCls='fuera';
    var estadoTxt='Fuera de las zonas de amenaza';
    if(d.nivel_amenaza==='Mayor'){estadoCls='mayor';estadoTxt='Dentro de zona de amenaza Mayor';}
    else if(d.nivel_amenaza==='Menor'){estadoCls='menor';estadoTxt='Dentro de zona de amenaza Menor';}

    var html='<div class="amenaza-estado '+estadoCls+'">'+(d.estado||estadoTxt)+'</div>';

    html+='<div class="amenaza-dato-sep">Ubicacion</div>';
    html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Nivel</span><span class="amenaza-dato-value">'+(d.nivel_amenaza||'Ninguna')+'</span></div>';
    if(d.canton)html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Canton</span><span class="amenaza-dato-value">'+d.canton+'</span></div>';

    html+='<div class="amenaza-dato-sep">Elementos cercanos</div>';
    if(d.rio_mas_cercano)html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Rio mas cercano</span><span class="amenaza-dato-value">'+d.rio_mas_cercano+'</span></div>';
    if(d.distancia_rio_m!=null)html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Distancia al rio</span><span class="amenaza-dato-value">'+parseFloat(d.distancia_rio_m).toFixed(0)+' m</span></div>';
    if(d.distancia_via_m!=null)html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Distancia a via</span><span class="amenaza-dato-value">'+parseFloat(d.distancia_via_m).toFixed(0)+' m</span></div>';

    html+='<div class="amenaza-dato-sep">Reportes cercanos</div>';
    html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Reportes ciudadanos</span><span class="amenaza-dato-value">'+(d.reportes_ciudadanos!=null?d.reportes_ciudadanos:0)+'</span></div>';
    html+='<div class="amenaza-dato"><span class="amenaza-dato-label">Reportes de exposicion</span><span class="amenaza-dato-value">'+(d.reportes_exposicion!=null?d.reportes_exposicion:0)+'</span></div>';

    if(d.mensaje_alerta)html+='<div class="amenaza-mensaje">'+d.mensaje_alerta+'</div>';

    resultado.innerHTML=html;

    var pdfBtn=document.getElementById('btn-amenaza-pdf');
    if(pdfBtn)pdfBtn.style.display='flex';
}

function descargarAmenazaPDF(){
    if(!amenazaResultData)return;
    var d=amenazaResultData;
    var now=new Date();
    var fecha=d.fecha_consulta||now.toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'});
    var hora=d.hora_consulta||now.toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'});

    var estadoColor='#16a34a';
    var estadoTxt='Fuera de zona de amenaza';
    if(d.nivel_amenaza==='Mayor'){estadoColor='#dc2626';estadoTxt='DENTRO DE ZONA DE AMENAZA MAYOR';}
    else if(d.nivel_amenaza==='Menor'){estadoColor='#d97706';estadoTxt='DENTRO DE ZONA DE AMENAZA MENOR';}

    var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Amenaza Cotopaxi</title>';
    h+='<style>';
    h+='body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;max-width:700px;margin:0 auto;}';
    h+='h1{font-size:20px;text-align:center;margin-bottom:2px;color:#1e3a5f;}';
    h+='h2{font-size:12px;text-align:center;color:#64748b;font-weight:normal;margin-top:0;}';
    h+='.badge-alerta{display:block;text-align:center;font-size:13px;font-weight:bold;color:#fff;background:'+estadoColor+';padding:10px 16px;border-radius:6px;margin:16px 0;letter-spacing:0.5px;}';
    h+='.coordenadas{text-align:center;color:#64748b;font-size:11px;margin-bottom:14px;}';
    h+='hr{border:none;border-top:1px solid #e2e8f0;margin:14px 0;}';
    h+='.seccion{margin-bottom:12px;}';
    h+='.seccion-titulo{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:bold;letter-spacing:0.5px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;margin-bottom:6px;}';
    h+='.campo{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f8fafc;}';
    h+='.campo-label{font-size:11px;color:#475569;}';
    h+='.campo-valor{font-size:12px;font-weight:bold;color:#1e3a5f;text-align:right;}';
    h+='.alerta-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-top:10px;font-size:11px;color:#92400e;line-height:1.5;}';
    h+='.footer{text-align:center;color:#94a3b8;font-size:9px;margin-top:24px;font-style:italic;border-top:1px solid #e2e8f0;padding-top:12px;}';
    h+='</style></head><body>';
    h+='<h1>Geoportal Cotopaxi</h1>';
    h+='<h2>Reporte de Consulta de Amenaza por Lahar</h2>';
    h+='<hr>';
    h+='<div class="badge-alerta">'+estadoTxt+'</div>';
    var latStr='No disponible';
    var lonStr='No disponible';
    if(d.latitud!=null&&!isNaN(parseFloat(d.latitud)))latStr=parseFloat(d.latitud).toFixed(6);
    if(d.longitud!=null&&!isNaN(parseFloat(d.longitud)))lonStr=parseFloat(d.longitud).toFixed(6);
    h+='<div class="coordenadas">Latitud: '+latStr+'<br>Longitud: '+lonStr+'</div>';
    h+='<div class="seccion"><div class="seccion-titulo">Datos de la Consulta</div>';
    h+='<div class="campo"><div class="campo-label">Fecha de consulta</div><div class="campo-valor">'+fecha+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Hora de consulta</div><div class="campo-valor">'+hora+'</div></div>';
    h+='</div>';
    h+='<div class="seccion"><div class="seccion-titulo">Estado de Amenaza</div>';
    h+='<div class="campo"><div class="campo-label">Estado</div><div class="campo-valor">'+(d.estado||'-')+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Nivel de amenaza</div><div class="campo-valor" style="color:'+estadoColor+';">'+(d.nivel_amenaza||'Ninguna')+'</div></div>';
    if(d.canton)h+='<div class="campo"><div class="campo-label">Canton</div><div class="campo-valor">'+d.canton+'</div></div>';
    h+='</div>';
    h+='<div class="seccion"><div class="seccion-titulo">Elementos Cercanos</div>';
    if(d.rio_mas_cercano)h+='<div class="campo"><div class="campo-label">Rio mas cercano</div><div class="campo-valor">'+d.rio_mas_cercano+'</div></div>';
    if(d.distancia_rio_m!=null)h+='<div class="campo"><div class="campo-label">Distancia al rio</div><div class="campo-valor">'+parseFloat(d.distancia_rio_m).toFixed(0)+' m</div></div>';
    if(d.distancia_via_m!=null)h+='<div class="campo"><div class="campo-label">Distancia a via cercana</div><div class="campo-valor">'+parseFloat(d.distancia_via_m).toFixed(0)+' m</div></div>';
    h+='</div>';
    h+='<div class="seccion"><div class="seccion-titulo">Reportes en la Zona</div>';
    h+='<div class="campo"><div class="campo-label">Reportes ciudadanos</div><div class="campo-valor">'+(d.reportes_ciudadanos!=null?d.reportes_ciudadanos:0)+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Reportes de exposicion</div><div class="campo-valor">'+(d.reportes_exposicion!=null?d.reportes_exposicion:0)+'</div></div>';
    h+='</div>';
    if(d.mensaje_alerta){
        h+='<div class="alerta-box"><strong>Mensaje de alerta:</strong><br>'+d.mensaje_alerta+'</div>';
    }
    h+='<hr>';
    h+='<div class="footer">Geoportal Cotopaxi - Sistema de Informacion Geografica<br>Fuente: consultar_ubicacion() | CRS: EPSG:4326 - WGS 84<br>Este documento es informativo y no constituye una evacuacion oficial.</div>';
    h+='</body></html>';

    var win=window.open('','_blank');
    win.document.write(h);win.document.close();
    setTimeout(function(){win.print();},500);
}

map.on('click',function(e){
    if(!consultandoAmenaza)return;
    if(marcadorAmenaza)map.removeLayer(marcadorAmenaza);
    var icono=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#dc2626;">&#9888;</div>',iconSize:[28,28],iconAnchor:[14,14]});
    marcadorAmenaza=L.marker(e.latlng,{icon:icono}).addTo(map);
    consultarAmenaza(e.latlng.lat,e.latlng.lng);
});

function usarMiUbicacionAmenaza(){
    if(!navigator.geolocation){
        alert('Tu navegador no soporta geolocalizacion.');
        return;
    }
    var btn=document.getElementById('btn-amenaza-geo');
    btn.disabled=true;
    var origHtml=btn.innerHTML;
    btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg> Ubicando...';
    navigator.geolocation.getCurrentPosition(function(pos){
        btn.disabled=false;btn.innerHTML=origHtml;
        var lat=pos.coords.latitude,lng=pos.coords.longitude;
        if(marcadorAmenaza)map.removeLayer(marcadorAmenaza);
        var icono=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#dc2626;">&#9888;</div>',iconSize:[28,28],iconAnchor:[14,14]});
        marcadorAmenaza=L.marker([lat,lng],{icon:icono}).addTo(map);
        map.setView([lat,lng],13);
        consultarAmenaza(lat,lng);
    },function(err){
        btn.disabled=false;btn.innerHTML=origHtml;
        console.error('Geolocation error:',err);
        alert('No se pudo obtener tu ubicacion. Verifica los permisos del navegador e intenta de nuevo.');
    },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

function mostrarReporteMsg(tipo,texto){
    var msg=document.getElementById('reporte-msg');
    msg.className='reporte-msg '+tipo;msg.innerHTML=texto;
    setTimeout(function(){msg.className='reporte-msg hidden';},5000);
}

async function enviarReporte(){
    var nombre=document.getElementById('rep-nombre').value.trim()||'Anonimo';
    var categoria=document.getElementById('rep-categoria').value;
    var descripcion=document.getElementById('rep-descripcion').value.trim();
    if(!categoria){mostrarReporteMsg('error','Selecciona una categoria de problema.');return;}
    if(!reporteUbicacion.lat||!reporteUbicacion.lng){mostrarReporteMsg('error','Selecciona una ubicacion en el mapa.');return;}
    var btn=document.getElementById('btn-enviar');
    btn.disabled=true;btn.textContent='Enviando...';
    try{
        var registro={nombre:nombre,categoria:categoria,descripcion:descripcion||null,latitud:reporteUbicacion.lat,longitud:reporteUbicacion.lng};
        var response=await fetch(SUPABASE_URL+'/rest/v1/reportes_ciudadanos',{method:'POST',headers:{'apikey':API_KEY,'Authorization':'Bearer '+API_KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(registro)});
        if(!response.ok){var err=await response.json();throw new Error(err.message||'Error al enviar');}
        var resultado=await response.json();
        mostrarReporteEnMapa(resultado[0]);
        mostrarReporteMsg('exito','Reporte enviado correctamente. Gracias.');
        document.getElementById('rep-nombre').value='';document.getElementById('rep-categoria').value='';document.getElementById('rep-descripcion').value='';
        document.getElementById('rep-ubicacion-texto').textContent='Haz clic en el mapa para ubicar';
        document.getElementById('rep-ubicacion').className='ubicacion-box';
        document.getElementById('btn-ubicacion').textContent='Seleccionar ubicacion';document.getElementById('btn-ubicacion').classList.remove('activo');
        if(marcadorTemporal){map.removeLayer(marcadorTemporal);marcadorTemporal=null;}
        reporteUbicacion={lat:null,lng:null};
        restaurarInteractividadCapas();
    }catch(err){console.error('Error reporte:',err);mostrarReporteMsg('error','Error al enviar: '+err.message);}
    btn.disabled=false;btn.textContent='Enviar Reporte';
}

function cancelarReporte(){
    seleccionandoUbicacion=false;
    if(marcadorTemporal){map.removeLayer(marcadorTemporal);marcadorTemporal=null;}
    reporteUbicacion={lat:null,lng:null};
    document.getElementById('rep-nombre').value='';
    document.getElementById('rep-categoria').value='';
    document.getElementById('rep-descripcion').value='';
    document.getElementById('rep-ubicacion-texto').textContent='Haz clic en el mapa para ubicar';
    document.getElementById('rep-ubicacion').className='ubicacion-box';
    var btn=document.getElementById('btn-ubicacion');
    btn.textContent='Seleccionar ubicacion';btn.classList.remove('activo');
    document.getElementById('map-container').classList.remove('mapa-seleccionando');
    map.getContainer().style.cursor='';
    restaurarInteractividadCapas();
}

function mostrarReporteEnMapa(report){
    var color=COLORES_CATEGORIA[report.categoria]||'#6b7280';
    var icono=ICONOS_CATEGORIA[report.categoria]||'&#9888;';
    var icon=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:'+color+';width:32px;height:32px;font-size:16px;">'+icono+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
    var marker=L.marker(L.latLng(report.latitud,report.longitud),{icon:icon,zIndexOffset:1000}).addTo(capaReportes);
    var popupHtml='<div style="padding:12px 14px 10px;border-bottom:1px solid #edf0f4;font-family:Inter,sans-serif;"><span style="font-size:14px;font-weight:700;color:'+color+';">Reporte Ciudadano</span></div><div style="padding:8px 14px 12px;font-family:Inter,sans-serif;">';
    popupHtml+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;"><span style="font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;">Categoria</span><span style="color:#1a1a2e;font-size:12px;font-weight:500;">'+report.categoria+'</span></div>';
    if(report.nombre&&report.nombre!=='Anonimo')popupHtml+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;"><span style="font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;">Por</span><span style="color:#1a1a2e;font-size:12px;font-weight:500;">'+report.nombre+'</span></div>';
    if(report.descripcion)popupHtml+='<div style="padding:5px 0;"><span style="font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;display:block;margin-bottom:3px;">Descripcion</span><span style="color:#1a1a2e;font-size:11px;line-height:1.4;">'+report.descripcion+'</span></div>';
    popupHtml+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid #f1f5f9;margin-top:4px;"><span style="font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;">Estado</span><span style="color:#f59e0b;font-size:11px;font-weight:600;">Pendiente</span></div></div>';
    marker.bindPopup(popupHtml,{maxWidth:260,maxHeight:200});
}

async function cargarReportesExistentes(){
    try{
        var response=await fetch(SUPABASE_URL+'/rest/v1/reportes_ciudadanos?select=*&order=fecha.desc&limit=500',{
            headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY,'Prefer':'return=representation'}
        });
        if(!response.ok){
            var errText=await response.text();
            console.error('Error HTTP '+response.status+':',errText);
            return;
        }
        var datos=await response.json();
        if(!datos||datos.length===0){
            console.log('No hay reportes ciudadanos registrados.');
            return;
        }
        console.log('Cargando '+datos.length+' reportes ciudadanos...');
        datos.forEach(function(report){
            if(report.latitud&&report.longitud){
                mostrarReporteEnMapa(report);
            }
        });
        console.log('Reportes cargados en el mapa.');
    }catch(err){
        console.error('Error cargando reportes:',err);
    }
}

/* ===== REPORTES DE EXPOSICION ===== */
var exposicionUbicacion={lat:null,lng:null};
var seleccionandoExposicion=false;
var marcadorExposicion=null;

var COLORES_EVENTO={'Lahar':'#dc2626','Desbordamiento de rio':'#2563eb','Obstruccion de cauce':'#7c3aed','Dano en via':'#ea580c','Deslizamiento':'#059669','Caida de ceniza':'#6b7280','Otro':'#64748b'};
var ICONOS_EVENTO={'Lahar':'&#127755;','Desbordamiento de rio':'&#127754;','Obstruccion de cauce':'&#128683;','Dano en via':'&#128679;','Deslizamiento':'&#9888;','Caida de ceniza':'&#9729;','Otro':'&#9888;'};
var COLORES_NIVEL={'Baja':'#22c55e','Media':'#f59e0b','Alta':'#dc2626'};

function toggleFormularioExposicion(){
    var collapse=document.getElementById('panel-exposicion-collapse');
    var arrow=document.getElementById('toggle-arrow-exp');
    if(collapse.classList.contains('abierto')){collapse.classList.remove('abierto');arrow.classList.remove('abierto');}
    else{collapse.classList.add('abierto');arrow.classList.add('abierto');}
}

function activarSeleccionExposicion(){
    seleccionandoExposicion=!seleccionandoExposicion;
    var btn=document.getElementById('btn-exp-ubicacion');
    var box=document.getElementById('exp-ubicacion');
    var contenedor=document.getElementById('map-container');
    if(seleccionandoExposicion){
        desactivarInteractividadCapas();
        btn.classList.add('activo');btn.textContent='Cancelar seleccion';
        box.classList.add('seleccionando');box.classList.remove('ubicado');
        document.getElementById('exp-ubicacion-texto').textContent='Haz clic en el mapa para ubicar el evento';
        contenedor.classList.add('mapa-seleccionando');map.getContainer().style.cursor='crosshair';
    }else{
        restaurarInteractividadCapas();
        btn.classList.remove('activo');btn.textContent='Seleccionar ubicacion';
        box.classList.remove('seleccionando');
        contenedor.classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
    }
}

function usarMiUbicacionExposicion(){
    if(!navigator.geolocation){mostrarExposicionMsg('error','Tu navegador no soporta geolocalizacion.');return;}
    var btn=document.getElementById('btn-exp-mi-ubicacion');
    btn.disabled=true;btn.textContent='Obteniendo...';
    navigator.geolocation.getCurrentPosition(function(posicion){
        var lat=posicion.coords.latitude;var lng=posicion.coords.longitude;
        exposicionUbicacion.lat=lat;exposicionUbicacion.lng=lng;
        if(marcadorExposicion)map.removeLayer(marcadorExposicion);
        var icon=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#f59e0b;width:32px;height:32px;font-size:16px;">&#9888;</div>',iconSize:[32,32],iconAnchor:[16,16]});
        marcadorExposicion=L.marker([lat,lng],{icon:icon,draggable:true,zIndexOffset:1000}).addTo(map);
        marcadorExposicion.on('dragend',function(e){
            var pos=e.target.getLatLng();
            exposicionUbicacion.lat=pos.lat;exposicionUbicacion.lng=pos.lng;
            var box=document.getElementById('exp-ubicacion');
            box.classList.add('ubicado');box.classList.remove('seleccionando');
            document.getElementById('exp-ubicacion-texto').innerHTML='&#10003; <b>'+pos.lat.toFixed(6)+', '+pos.lng.toFixed(6)+'</b>';
        });
        map.setView([lat,lng],14);
        var box=document.getElementById('exp-ubicacion');
        box.classList.add('ubicado');box.classList.remove('seleccionando');
        document.getElementById('exp-ubicacion-texto').innerHTML='&#10003; <b>'+lat.toFixed(6)+', '+lng.toFixed(6)+'</b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)</span>';
        btn.disabled=false;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg> Mi ubicacion';
        seleccionandoExposicion=false;
        restaurarInteractividadCapas();
        document.getElementById('btn-exp-ubicacion').classList.remove('activo');
        document.getElementById('btn-exp-ubicacion').textContent='Seleccionar ubicacion';
        document.getElementById('map-container').classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
    },function(error){
        var msg='No se pudo obtener tu ubicacion.';
        if(error.code===1)msg='Permiso de ubicacion denegado.';
        else if(error.code===2)msg='Ubicacion no disponible.';
        else if(error.code===3)msg='Tiempo de espera agotado.';
        mostrarExposicionMsg('error',msg);
        btn.disabled=false;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg> Mi ubicacion';
    },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

map.on('click',function(e){
    if(!seleccionandoExposicion)return;
    exposicionUbicacion.lat=e.latlng.lat;exposicionUbicacion.lng=e.latlng.lng;
    if(marcadorExposicion)map.removeLayer(marcadorExposicion);
    var icon=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:#f59e0b;width:32px;height:32px;font-size:16px;">&#9888;</div>',iconSize:[32,32],iconAnchor:[16,16]});
    marcadorExposicion=L.marker(e.latlng,{icon:icon,draggable:true,zIndexOffset:1000}).addTo(map);
    marcadorExposicion.on('dragend',function(ev){
        var pos=ev.target.getLatLng();
        exposicionUbicacion.lat=pos.lat;exposicionUbicacion.lng=pos.lng;
        var box=document.getElementById('exp-ubicacion');
        box.classList.add('ubicado');box.classList.remove('seleccionando');
        document.getElementById('exp-ubicacion-texto').innerHTML='&#10003; <b>'+pos.lat.toFixed(6)+', '+pos.lng.toFixed(6)+'</b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)</span>';
    });
    var box=document.getElementById('exp-ubicacion');
    box.classList.add('ubicado');box.classList.remove('seleccionando');
    document.getElementById('exp-ubicacion-texto').innerHTML='&#10003; <b>'+e.latlng.lat.toFixed(6)+', '+e.latlng.lng.toFixed(6)+'</b> <span style="color:#94a3b8;font-size:10px;">(arrastra para ajustar)</span>';
    seleccionandoExposicion=false;
    restaurarInteractividadCapas();
    document.getElementById('btn-exp-ubicacion').classList.remove('activo');
    document.getElementById('btn-exp-ubicacion').textContent='Cambiar ubicacion';
    document.getElementById('map-container').classList.remove('mapa-seleccionando');map.getContainer().style.cursor='';
});

function mostrarExposicionMsg(tipo,texto){
    var msg=document.getElementById('exposicion-msg');
    if(tipo==='exito')msg.className='reporte-msg exito-exp';
    else msg.className='reporte-msg '+tipo;
    msg.innerHTML=texto;
    setTimeout(function(){msg.className='reporte-msg hidden';},5000);
}

async function enviarExposicion(){
    var nombre=document.getElementById('exp-nombre').value.trim()||'Anonimo';
    var tipoEvento=document.getElementById('exp-tipo-evento').value;
    var descripcion=document.getElementById('exp-descripcion').value.trim();
    var nivel=document.getElementById('exp-nivel').value;
    var fechaObs=document.getElementById('exp-fecha-obs').value;
    if(!tipoEvento){mostrarExposicionMsg('error','Selecciona un tipo de evento.');return;}
    if(!exposicionUbicacion.lat||!exposicionUbicacion.lng){mostrarExposicionMsg('error','Selecciona una ubicacion en el mapa.');return;}
    var btn=document.getElementById('btn-exp-enviar');
    btn.disabled=true;btn.textContent='Enviando...';
    try{
        var registro={nombre:nombre,tipo_evento:tipoEvento,descripcion:descripcion||null,nivel_afectacion:nivel,fecha_observacion:fechaObs||null,latitud:exposicionUbicacion.lat,longitud:exposicionUbicacion.lng};
        var response=await fetch(SUPABASE_URL+'/rest/v1/reportes_exposicion',{method:'POST',headers:{'apikey':API_KEY,Authorization:'Bearer '+API_KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(registro)});
        if(!response.ok){var err=await response.json();throw new Error(err.message||'Error al enviar');}
        var resultado=await response.json();
        mostrarExposicionEnMapa(resultado[0]);
        mostrarExposicionMsg('exito','Reporte de exposicion enviado correctamente. Gracias.');
        document.getElementById('exp-nombre').value='';document.getElementById('exp-tipo-evento').value='';document.getElementById('exp-descripcion').value='';document.getElementById('exp-nivel').value='Media';document.getElementById('exp-fecha-obs').value='';
        document.getElementById('exp-ubicacion-texto').textContent='Haz clic en el mapa para ubicar';
        document.getElementById('exp-ubicacion').className='ubicacion-box';
        document.getElementById('btn-exp-ubicacion').textContent='Seleccionar ubicacion';document.getElementById('btn-exp-ubicacion').classList.remove('activo');
        if(marcadorExposicion){map.removeLayer(marcadorExposicion);marcadorExposicion=null;}
        exposicionUbicacion={lat:null,lng:null};
        restaurarInteractividadCapas();
    }catch(err){console.error('Error exposicion:',err);mostrarExposicionMsg('error','Error al enviar: '+err.message);}
    btn.disabled=false;btn.textContent='Enviar Reporte de Exposicion';
}

function cancelarExposicion(){
    seleccionandoExposicion=false;
    if(marcadorExposicion){map.removeLayer(marcadorExposicion);marcadorExposicion=null;}
    exposicionUbicacion={lat:null,lng:null};
    document.getElementById('exp-nombre').value='';
    document.getElementById('exp-tipo-evento').value='';
    document.getElementById('exp-descripcion').value='';
    document.getElementById('exp-nivel').value='Media';
    document.getElementById('exp-fecha-obs').value='';
    document.getElementById('exp-ubicacion-texto').textContent='Haz clic en el mapa para ubicar';
    document.getElementById('exp-ubicacion').className='ubicacion-box';
    var btn=document.getElementById('btn-exp-ubicacion');
    btn.textContent='Seleccionar ubicacion';btn.classList.remove('activo');
    document.getElementById('map-container').classList.remove('mapa-seleccionando');
    map.getContainer().style.cursor='';
    restaurarInteractividadCapas();
}

function mostrarExposicionEnMapa(report){
    var color=COLORES_EVENTO[report.tipo_evento]||'#64748b';
    var icono=ICONOS_EVENTO[report.tipo_evento]||'&#9888;';
    var nivelColor=COLORES_NIVEL[report.nivel_afectacion]||'#f59e0b';
    var icon=L.divIcon({className:'',html:'<div class="reporte-marker" style="background:'+color+';width:32px;height:32px;font-size:16px;border:3px solid '+nivelColor+';">'+icono+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
    var marker=L.marker(L.latLng(report.latitud,report.longitud),{icon:icon,zIndexOffset:1000}).addTo(capaExposicion);
    var sH='padding:12px 14px 10px;border-bottom:1px solid #edf0f4;font-family:Inter,sans-serif;';
    var sB='padding:8px 14px 12px;font-family:Inter,sans-serif;';
    var sR='display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;';
    var sL='font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.3px;font-family:Inter,sans-serif;';
    var sV='color:#1a1a2e;font-size:12px;font-weight:500;text-align:right;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:Inter,sans-serif;';
    var popupHtml='<div style="'+sH+'"><span style="font-size:14px;font-weight:700;color:'+color+';">Reporte de Exposicion</span></div><div style="'+sB+'">';
    popupHtml+='<div style="'+sR+'"><span style="'+sL+'">Tipo</span><span style="'+sV+'">'+report.tipo_evento+'</span></div>';
    if(report.nombre&&report.nombre!=='Anonimo')popupHtml+='<div style="'+sR+'"><span style="'+sL+'">Reportado por</span><span style="'+sV+'">'+report.nombre+'</span></div>';
    popupHtml+='<div style="'+sR+'"><span style="'+sL+'">Nivel</span><span style="'+sV+'color:'+nivelColor+';font-weight:700;">'+report.nivel_afectacion+'</span></div>';
    if(report.descripcion)popupHtml+='<div style="padding:5px 0;"><span style="'+sL+'display:block;margin-bottom:3px;">Descripcion</span><span style="color:#1a1a2e;font-size:11px;line-height:1.4;">'+report.descripcion+'</span></div>';
    if(report.fecha_observacion)popupHtml+='<div style="'+sR+'"><span style="'+sL+'">Fecha Observacion</span><span style="'+sV+'">'+report.fecha_observacion+'</span></div>';
    if(report.fecha_reporte)popupHtml+='<div style="'+sR+'border-top:1px solid #f1f5f9;margin-top:4px;"><span style="'+sL+'">Fecha Reporte</span><span style="'+sV+'font-size:10px;">'+new Date(report.fecha_reporte).toLocaleString('es-EC')+'</span></div>';
    popupHtml+='</div>';
    marker.bindPopup(popupHtml,{maxWidth:280,maxHeight:240});
}

async function cargarExposicionesExistentes(){
    try{
        var response=await fetch(SUPABASE_URL+'/rest/v1/reportes_exposicion?select=*&order=fecha_reporte.desc&limit=500',{
            headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY,'Prefer':'return=representation'}
        });
        if(!response.ok){
            var errText=await response.text();
            console.error('Error HTTP exposicion '+response.status+':',errText);
            return;
        }
        var datos=await response.json();
        if(!datos||datos.length===0){
            console.log('No hay reportes de exposicion registrados.');
            return;
        }
        console.log('Cargando '+datos.length+' reportes de exposicion...');
        datos.forEach(function(report){
            if(report.latitud&&report.longitud){
                mostrarExposicionEnMapa(report);
            }
        });
        console.log('Reportes de exposicion cargados en el mapa.');
    }catch(err){
        console.error('Error cargando reportes de exposicion:',err);
    }
}

/* ===== PANEL DE INDICADORES ===== */
var panelIndicadoresAbierto=false;
var indicadoresData=null;

function togglePanelIndicadores(){
    panelIndicadoresAbierto=!panelIndicadoresAbierto;
    var panel=document.getElementById('panel-indicadores');
    var toggle=document.getElementById('panel-indicadores-toggle');
    var arrow=document.getElementById('toggle-arrow-ind');
    if(panelIndicadoresAbierto){
        panel.classList.add('abierto');
        toggle.classList.add('activo');
        if(arrow)arrow.classList.add('abierto');
        cargarIndicadores();
    }else{
        panel.classList.remove('abierto');
        toggle.classList.remove('activo');
        if(arrow)arrow.classList.remove('abierto');
    }
}

async function cargarIndicadores(){
    var body=document.getElementById('panel-ind-body');
    var btn=document.getElementById('btn-actualizar');
    btn.disabled=true;
    btn.innerHTML='<div class="btn-spinner"></div> Cargando...';
    body.innerHTML='<div class="panel-ind-loading"><div class="spinner-ind"></div><span>Cargando indicadores...</span></div>';
    try{
        var response=await fetch(SUPABASE_URL+'/rest/v1/vw_indicadores_cotopaxi?select=*',{headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY}});
        if(!response.ok)throw new Error('Error HTTP '+response.status);
        var data=await response.json();
        if(!data||data.length===0){
            body.innerHTML='<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.78rem;">No hay datos de indicadores disponibles.</div>';
            return;
        }
        indicadoresData=data;
        renderizarIndicadores(data);
    }catch(err){
        console.error('Error cargando indicadores:',err);
        body.innerHTML='<div style="padding:20px 16px;text-align:center;font-size:0.78rem;"><div style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:10px;padding:14px;"><strong>No se pudieron obtener los indicadores</strong><br><span style="font-size:0.7rem;color:#94a3b8;margin-top:4px;display:block;">Verifica tu conexion a Supabase e intenta de nuevo.</span><br><span style="font-size:0.65rem;color:#b0bec5;">'+err.message+'</span></div></div>';
    }finally{
        btn.disabled=false;
        btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Actualizar';
    }
}

function renderizarIndicadores(data){
    var body=document.getElementById('panel-ind-body');
    var fecha=new Date().toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'});

    var totalArea=0,totalExpuesta=0,totalMayor=0,totalMenor=0,sumPct=0,sumMayor=0,sumMenor=0,sumFuera=0,sumIndice=0;
    var cats={Baja:0,Media:0,Alta:0,'Muy alta':0};
    var amenazas={Mayor:0,Menor:0};
    var ranking=[];

    data.forEach(function(d){
        var area=parseFloat(d.area_total_km2)||0;
        var exp=parseFloat(d.area_expuesta_km2)||0;
        var mayor=parseFloat(d.area_mayor_km2)||0;
        var menor=parseFloat(d.area_menor_km2)||0;
        var pct=parseFloat(d.porcentaje_expuesto)||0;
        var pctMayor=parseFloat(d.porcentaje_mayor)||0;
        var pctMenor=parseFloat(d.porcentaje_menor)||0;
        var pctFuera=parseFloat(d.porcentaje_fuera)||0;
        var indice=parseFloat(d.indice_exposicion)||0;
        totalArea+=area;
        totalExpuesta+=exp;
        totalMayor+=mayor;
        totalMenor+=menor;
        sumPct+=pct;
        sumMayor+=pctMayor;
        sumMenor+=pctMenor;
        sumFuera+=pctFuera;
        sumIndice+=indice;
        var cat=d.categoria_exposicion||'Sin datos';
        if(cats[cat]!==undefined)cats[cat]++;
        var am=d.nivel_predominante||'Sin amenaza';
        if(am==='Mayor')amenazas.Mayor++;
        else if(am==='Menor')amenazas.Menor++;
        ranking.push({nombre:d.nombre_territorio,tipo:d.tipo_territorio,canton:d.canton,indice:indice,cat:cat});
    });

    var promPct=data.length>0?(sumPct/data.length).toFixed(1):'0';
    var avgMayor=data.length>0?(sumMayor/data.length).toFixed(1):'0';
    var avgMenor=data.length>0?(sumMenor/data.length).toFixed(1):'0';
    var avgFuera=data.length>0?(sumFuera/data.length).toFixed(1):'0';
    var avgIndice=data.length>0?(sumIndice/data.length).toFixed(1):'0';
    var amenazaPred=amenazas.Mayor>=amenazas.Menor?'Mayor':'Menor';
    var totalFuera=totalArea-totalExpuesta;
    ranking.sort(function(a,b){return b.indice-a.indice;});
    var top5=ranking.slice(0,5);

    var ico=function(tt){return ' <i class="ind-info-icon" data-tooltip="'+tt+'">&#9432;</i>';};
    var html='';

    html+='<div class="ind-seccion">';
    html+='<div class="ind-seccion-titulo">Resumen Territorial</div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#ede9fe;color:#7c3aed;">&#127758;</div><div class="ind-card-info"><div class="ind-card-label">Total territorios</div><div class="ind-card-value">'+data.length+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#eff6ff;color:#3b82f6;">&#128207;</div><div class="ind-card-info"><div class="ind-card-label">Area total evaluada</div><div class="ind-card-value">'+totalArea.toFixed(2)+' <span style="font-size:0.7rem;font-weight:600;color:#64748b;">km2</span></div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#fef2f2;color:#dc2626;">&#9888;</div><div class="ind-card-info"><div class="ind-card-label">Area total expuesta</div><div class="ind-card-value">'+totalExpuesta.toFixed(2)+' <span style="font-size:0.7rem;font-weight:600;color:#64748b;">km2</span></div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#fffbeb;color:#d97706;">&#128200;</div><div class="ind-card-info"><div class="ind-card-label">Promedio exposicion'+ico('Promedio porcentual de exposicion a amenaza por lahar en todos los territorios evaluados.')+'</div><div class="ind-card-value">'+promPct+' <span style="font-size:0.7rem;font-weight:600;color:#64748b;">%</span></div></div></div>';
    html+='</div>';

    html+='<div class="ind-seccion">';
    html+='<div class="ind-seccion-titulo">Clasificacion</div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:'+(amenazaPred==='Mayor'?'#fef2f2;color:#dc2626':'#fffbeb;color:#d97706')+';">&#9888;</div><div class="ind-card-info"><div class="ind-card-label">Zona de amenaza por lahar'+ico('Nivel de amenaza que ocupa la mayor superficie del territorio segun el mapa oficial de amenaza por lahares.')+'</div><div class="ind-descripcion">Nivel de amenaza por lahar que ocupa la mayor parte del territorio analizado.</div><div class="ind-card-value" style="color:'+(amenazaPred==='Mayor'?'#dc2626':'#d97706')+';">'+amenazaPred+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#ede9fe;color:#7c3aed;">&#128200;</div><div class="ind-card-info"><div class="ind-card-label">Indice de exposicion territorial'+ico('Valor numerico que resume el nivel de exposicion territorial considerando superficie afectada, vias y red hidrica.')+'</div><div class="ind-descripcion">Indicador cuantitativo calculado a partir de la superficie expuesta, la infraestructura vial y la red hidrica presentes dentro de las zonas de amenaza.</div><div class="ind-card-value">'+avgIndice+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#f0fdf4;color:#16a34a;">&#128203;</div><div class="ind-card-info"><div class="ind-card-label">Nivel de exposicion territorial'+ico('Clasificacion cualitativa obtenida a partir del indice de exposicion territorial.')+'</div><div class="ind-descripcion">Clasificacion cualitativa obtenida a partir del indice de exposicion territorial.</div><div class="ind-card-value" style="font-size:0.85rem;">'+cats.Baja+' Baja / '+cats.Media+' Media / '+cats.Alta+' Alta / '+cats['Muy alta']+' Muy alta</div></div></div>';
    html+='</div>';

    html+='<div class="ind-seccion">';
    html+='<div class="ind-seccion-titulo">Territorios por Categoria</div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#f0fdf4;color:#16a34a;">&#9989;</div><div class="ind-card-info"><div class="ind-card-label">Baja</div><div class="ind-card-value">'+cats.Baja+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#fffbeb;color:#d97706;">&#9888;</div><div class="ind-card-info"><div class="ind-card-label">Media</div><div class="ind-card-value">'+cats.Media+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#fef2f2;color:#dc2626;">&#128680;</div><div class="ind-card-info"><div class="ind-card-label">Alta</div><div class="ind-card-value">'+cats.Alta+'</div></div></div>';
    html+='<div class="ind-card"><div class="ind-card-icon" style="background:#fef2f2;color:#991b1b;">&#128308;</div><div class="ind-card-info"><div class="ind-card-label">Muy alta</div><div class="ind-card-value">'+cats['Muy alta']+'</div></div></div>';
    html+='</div>';

    html+='<div class="ind-seccion">';
    html+='<div class="ind-seccion-titulo">Ranking por Indice de Exposicion</div>';
    top5.forEach(function(r,i){
        var catClass='cat-baja';
        if(r.cat==='Media')catClass='cat-media';
        else if(r.cat==='Alta')catClass='cat-alta';
        else if(r.cat==='Muy alta')catClass='cat-muy-alta';
        html+='<div class="ind-card"><div class="ind-card-icon" style="background:#f8fafc;color:#1e3a5f;font-size:0.85rem;font-weight:800;">#'+(i+1)+'</div><div class="ind-card-info"><div class="ind-card-label">'+(r.nombre||'-')+'</div><div class="ind-card-value" style="font-size:1rem;">'+r.indice.toFixed(1)+' <span class="'+catClass+'" style="font-size:0.55rem;padding:1px 6px;border-radius:8px;vertical-align:middle;">'+r.cat+'</span></div></div></div>';
    });
    html+='</div>';

    html+='<div style="margin-top:16px;padding:10px 14px;background:#f8fafc;border:1px solid #e8ecf1;border-radius:10px;font-size:0.62rem;color:#94a3b8;text-align:center;">';
    html+='Indicadores actualizados el '+fecha+'<br>Geoportal Cotopaxi - Amenaza por Lahar';
    html+='</div>';

    body.innerHTML=html;
}

function exportarPDF(){
    if(!indicadoresData||!indicadoresData.length){
        alert('Primero debes cargar los indicadores.');
        return;
    }
    var data=indicadoresData;
    var fecha=new Date().toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'});

    var totalArea=0,totalExpuesta=0,totalMayor=0,totalMenor=0,sumPct=0,sumMayor=0,sumMenor=0,sumFuera=0;
    var cats={Baja:0,Media:0,Alta:0,'Muy alta':0};
    var ranking=[];

    data.forEach(function(d){
        var area=parseFloat(d.area_total_km2)||0;
        var exp=parseFloat(d.area_expuesta_km2)||0;
        var mayor=parseFloat(d.area_mayor_km2)||0;
        var menor=parseFloat(d.area_menor_km2)||0;
        var pct=parseFloat(d.porcentaje_expuesto)||0;
        var pctMayor=parseFloat(d.porcentaje_mayor)||0;
        var pctMenor=parseFloat(d.porcentaje_menor)||0;
        var pctFuera=parseFloat(d.porcentaje_fuera)||0;
        totalArea+=area;totalExpuesta+=exp;totalMayor+=mayor;totalMenor+=menor;
        sumPct+=pct;sumMayor+=pctMayor;sumMenor+=pctMenor;sumFuera+=pctFuera;
        var cat=d.categoria_exposicion||'Sin datos';
        if(cats[cat]!==undefined)cats[cat]++;
        ranking.push({nombre:d.nombre_territorio,tipo:d.tipo_territorio,canton:d.canton,indice:parseFloat(d.indice_exposicion)||0,cat:cat});
    });
    var promPct=data.length>0?(sumPct/data.length).toFixed(1):'0';
    ranking.sort(function(a,b){return b.indice-a.indice;});
    var top5=ranking.slice(0,5);

    var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Indicadores Cotopaxi</title>';
    h+='<style>';
    h+='body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;}';
    h+='h1{font-size:22px;text-align:center;margin-bottom:4px;}';
    h+='h2{font-size:13px;text-align:center;color:#64748b;font-weight:normal;margin-top:0;}';
    h+='.date{text-align:center;color:#94a3b8;font-size:11px;margin-bottom:20px;}';
    h+='hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0;}';
    h+='.seccion{margin-bottom:14px;}';
    h+='.seccion-titulo{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:bold;letter-spacing:0.5px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;margin-bottom:8px;}';
    h+='.ind{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;}';
    h+='.ind-label{font-size:12px;color:#475569;}';
    h+='.ind-value{font-size:16px;font-weight:bold;color:#1e3a5f;}';
    h+='.footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;font-style:italic;}';
    h+='</style></head><body>';
    h+='<h1>Geoportal Cotopaxi</h1>';
    h+='<h2>Panel de Indicadores - Amenaza por Lahar</h2>';
    h+='<div class="date">Generado el '+fecha+'</div>';
    h+='<hr>';

    h+='<div class="seccion"><div class="seccion-titulo">Resumen Territorial</div>';
    h+='<div class="ind"><div class="ind-label">Total territorios</div><div class="ind-value">'+data.length+'</div></div>';
    h+='<div class="ind"><div class="ind-label">Area total evaluada</div><div class="ind-value">'+totalArea.toFixed(2)+' km2</div></div>';
    h+='<div class="ind"><div class="ind-label">Area total expuesta</div><div class="ind-value">'+totalExpuesta.toFixed(2)+' km2</div></div>';
    h+='<div class="ind"><div class="ind-label">% promedio exposicion</div><div class="ind-value">'+promPct+'%</div></div>';
    h+='</div>';

    h+='<div class="seccion"><div class="seccion-titulo">Territorios por Categoria de Exposicion</div>';
    h+='<div class="ind"><div class="ind-label">Baja</div><div class="ind-value">'+cats.Baja+'</div></div>';
    h+='<div class="ind"><div class="ind-label">Media</div><div class="ind-value">'+cats.Media+'</div></div>';
    h+='<div class="ind"><div class="ind-label">Alta</div><div class="ind-value">'+cats.Alta+'</div></div>';
    h+='<div class="ind"><div class="ind-label">Muy alta</div><div class="ind-value">'+cats['Muy alta']+'</div></div>';
    h+='</div>';

    h+='<div class="seccion"><div class="seccion-titulo">Ranking Top 5 - Indice de Exposicion</div>';
    top5.forEach(function(r,i){
        h+='<div class="ind"><div class="ind-label">#'+(i+1)+' '+r.nombre+' ('+r.tipo+')</div><div class="ind-value">'+r.indice.toFixed(1)+' - '+r.cat+'</div></div>';
    });
    h+='</div>';

    h+='<hr>';
    h+='<div class="footer">Geoportal Cotopaxi - Sistema de Informacion Geografica<br>Fuentes: vw_indicadores_cotopaxi, vw_exposicion_cotopaxi | CRS: EPSG:4326 - WGS 84</div>';
    h+='</body></html>';

    var win=window.open('','_blank');
    win.document.write(h);
    win.document.close();
    setTimeout(function(){win.print();},500);
}

/* ===== BUSCADOR INTELIGENTE DE TERRITORIOS ===== */
var territoriosDatos=[];
var territoriosCargados=false;
var territorioSeleccionado=null;
var seleccionHighlightLayer=null;
var filtrosActivos={tipo:null,amenaza:null,categoria:null};

function limpiarSeleccionAnterior(){
    if(seleccionHighlightLayer){
        try{map.removeLayer(seleccionHighlightLayer);}catch(e){}
        seleccionHighlightLayer=null;
    }
}

function selectFeature(opts){
    limpiarSeleccionAnterior();
    if(!opts||!opts.geometry)return;
    seleccionHighlightLayer=L.geoJSON(
        {type:'Feature',properties:{},geometry:opts.geometry},
        {style:function(){return{color:'#3b82f6',weight:3,fillColor:'#3b82f6',fillOpacity:0.3,opacity:1};}}
    ).addTo(map);
    if(opts.bounds){
        map.fitBounds(opts.bounds,{padding:[80,80],maxZoom:opts.maxZoom||15});
    }else if(opts.center){
        map.setView(opts.center,opts.zoom||14);
    }else{
        try{
            var b=seleccionHighlightLayer.getBounds();
            if(b&&b.isValid()){
                map.fitBounds(b,{padding:[80,80],maxZoom:14});
            }
        }catch(e){console.error('selectFeature fitBounds error:',e);}
    }
    if(opts.popupHtml){
        seleccionHighlightLayer.bindPopup(opts.popupHtml,opts.popupOptions||{maxWidth:300,maxHeight:340}).openPopup();
    }
}

function buscarEnCapas(nombre,tablasPermitidas){
    var busq=normalizeText(nombre);
    var resultado=null;
    CAPAS_CONFIG.forEach(function(config){
        if(resultado)return;
        if(tablasPermitidas&&tablasPermitidas.indexOf(config.tabla)===-1)return;
        var capa=capasCargadas[config.tabla];
        if(!capa)return;
        capa.eachLayer(function(layer){
            if(resultado||!layer.feature||!layer.feature.properties)return;
            var props=layer.feature.properties;
            var fields=config.camposMostrar;
            for(var f=0;f<fields.length;f++){
                var val=props[fields[f]];
                if(val&&normalizeText(String(val))===busq){
                    resultado=layer;
                    return;
                }
            }
        });
    });
    return resultado;
}

function buscarCapaPorNombre(nombre,tipoTerritorio){
    if(tipoTerritorio){
        var tipo=normalizeText(tipoTerritorio);
        var tablas=[];
        if(tipo.indexOf('canton')!==-1)tablas.push('cantones_lahar1');
        if(tipo.indexOf('parroquia')!==-1||tipo.indexOf('localidad')!==-1||tipo.indexOf('pueblo')!==-1)tablas.push('pueblos_area_estudio');
        if(tablas.length>0){
            var lyr=buscarEnCapas(nombre,tablas);
            if(lyr)return lyr;
        }
    }
    return buscarEnCapas(nombre);
}

function seleccionarFeatureDeCapa(lyr,opts){
    opts=opts||{};
    limpiarSeleccionAnterior();
    if(!lyr)return;
    selectFeature({
        geometry:lyr.toGeoJSON().geometry,
        popupHtml:opts.popupHtml||(lyr._popup?lyr._popup.getContent():null),
        popupOptions:opts.popupOptions||{maxWidth:300,maxHeight:340},
        bounds:lyr.getBounds?lyr.getBounds():null,
        center:lyr.getLatLng?[lyr.getLatLng().lat,lyr.getLatLng().lng]:null,
        maxZoom:opts.maxZoom||15
    });
}

function parsearEWKB(hex){
    if(!hex||typeof hex!=='string')return null;
    hex=hex.replace(/^0x/i,'');
    if(hex.length<20)return null;
    try{
        var bytes=[];
        for(var i=0;i<hex.length;i+=2){
            bytes.push(parseInt(hex.substr(i,2),16));
        }
        var view=new DataView(new Uint8Array(bytes).buffer);
        var offset=0;
        var byteOrder=bytes[offset];offset++;
        var tipo=view.getUint32(offset,byteOrder===1);offset+=4;
        var esMulti=(tipo===6);
        var esPoly=(tipo===3);
        if(!esMulti&&!esPoly)return null;

        if(bytes[offset]===0x20&&bytes[offset+1]===0x00&&bytes[offset+2]===0x00&&bytes[offset+3]===0x20){
            offset+=4;
        }else if((tipo&0x20000000)!==0){
            offset+=4;
        }

        if(esMulti){
            var numPolis=view.getUint32(offset,true);offset+=4;
            var polis=[];
            for(var p=0;p<numPolis;p++){
                if(bytes[offset]===1)offset++;
                else if(bytes[offset]===0)offset++;
                var subTipo=view.getUint32(offset,true);offset+=4;
                var anillos=parsearAnillos(bytes,view,offset);
                if(anillos.length>0)polis.push(anillos);
                offset=anillos._nextOffset||offset;
            }
            return{type:'MultiPolygon',coordinates:polis};
        }else{
            var anillos=parsearAnillos(bytes,view,offset);
            if(anillos.length>0)return{type:'Polygon',coordinates:[anillos]};
            return null;
        }
    }catch(e){
        console.error('Error parseando EWKB:',e);
        return null;
    }
}

function parsearAnillos(bytes,view,offset){
    var numRings=view.getUint32(offset,true);offset+=4;
    var rings=[];
    for(var r=0;r<numRings;r++){
        var numPoints=view.getUint32(offset,true);offset+=4;
        var coords=[];
        for(var n=0;n<numPoints;n++){
            var lng=view.getFloat64(offset,true);offset+=8;
            var lat=view.getFloat64(offset,true);offset+=8;
            coords.push([lat,lng]);
        }
        rings.push(coords);
    }
    rings._nextOffset=offset;
    return rings;
}

function parsearMultiPoligono(geom){
    if(!geom||!geom.coordinates)return null;
    if(geom.type==='Polygon')return geom.coordinates;
    if(geom.type==='MultiPolygon')return geom.coordinates;
    return null;
}

async function cargarTerritorios(){
    try{
        var urlInd=SUPABASE_URL+'/rest/v1/vw_indicadores_cotopaxi?select=*';
        var urlExp=SUPABASE_URL+'/rest/v1/vw_exposicion_cotopaxi?select=id,area_mayor_km2,area_menor_km2,porcentaje_mayor,porcentaje_menor,porcentaje_fuera';
        var[respInd,respExp]=await Promise.all([
            fetch(urlInd,{headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY}}),
            fetch(urlExp,{headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY}})
        ]);
        if(!respInd.ok)throw new Error('Error HTTP '+respInd.status);
        var datos=await respInd.json();
        var expDatos=respExp.ok?await respExp.json():[];
        var expMap={};
        for(var i=0;i<expDatos.length;i++)expMap[expDatos[i].id]=expDatos[i];
        if(!datos||datos.length===0){console.log('No hay territorios.');return;}
        territoriosDatos=datos.map(function(reg){
            var geom=reg.geom||reg.geometry||reg.geojson;
            if(typeof geom==='string')geom=parsearEWKB(geom);
            else if(geom&&geom.type)geom=geom;
            else geom=null;
            var exp=expMap[reg.id]||{};
            return{
                id:reg.id,
                nombre_territorio:reg.nombre_territorio,
                tipo_territorio:reg.tipo_territorio,
                canton:reg.canton,
                area_total_km2:parseFloat(reg.area_total_km2)||0,
                area_expuesta_km2:parseFloat(reg.area_expuesta_km2)||0,
                area_mayor_km2:parseFloat(exp.area_mayor_km2)||0,
                area_menor_km2:parseFloat(exp.area_menor_km2)||0,
                porcentaje_expuesto:parseFloat(reg.porcentaje_expuesto)||0,
                porcentaje_mayor:parseFloat(exp.porcentaje_mayor)||0,
                porcentaje_menor:parseFloat(exp.porcentaje_menor)||0,
                porcentaje_fuera:parseFloat(exp.porcentaje_fuera)||0,
                nivel_predominante:reg.nivel_predominante||'Sin amenaza',
                km_vias_afectadas:parseFloat(reg.km_vias_afectadas)||0,
                km_rios_afectados:parseFloat(reg.km_rios_afectados)||0,
                indice_exposicion:parseFloat(reg.indice_exposicion)||0,
                categoria_exposicion:reg.categoria_exposicion||'Sin datos',
                geom:geom
            };
        });
        territoriosCargados=true;
        console.log('Territorios cargados: '+territoriosDatos.length);
        actualizarContadorBuscador();
    }catch(err){
        console.error('Error cargando territorios:',err);
    }
}

function actualizarContadorBuscador(){
    var total=territoriosDatos.length;
    var filtrados=aplicarFiltros(document.getElementById('buscador-input').value);
    var countEl=document.getElementById('buscador-count');
    if(filtrados.length<total){
        countEl.textContent=filtrados.length+' de '+total;
    }else{
        countEl.textContent=total+' total';
    }
}

function normalizeText(s){
    if(!s)return'';
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function aplicarFiltros(texto){
    var resultados=territoriosDatos;
    if(texto&&texto.length>=2){
        var busq=normalizeText(texto);
        resultados=resultados.filter(function(t){
            return(t.nombre_territorio&&normalizeText(t.nombre_territorio).indexOf(busq)!==-1)||
                   (t.canton&&normalizeText(t.canton).indexOf(busq)!==-1)||
                   (t.tipo_territorio&&normalizeText(t.tipo_territorio).indexOf(busq)!==-1)||
                   (t.nivel_predominante&&normalizeText(t.nivel_predominante).indexOf(busq)!==-1)||
                   (t.categoria_exposicion&&normalizeText(t.categoria_exposicion).indexOf(busq)!==-1);
        });
    }
    if(filtrosActivos.tipo){
        resultados=resultados.filter(function(t){return normalizeText(t.tipo_territorio)===normalizeText(filtrosActivos.tipo);});
    }
    if(filtrosActivos.amenaza){
        resultados=resultados.filter(function(t){return normalizeText(t.nivel_predominante)===normalizeText(filtrosActivos.amenaza);});
    }
    if(filtrosActivos.categoria){
        resultados=resultados.filter(function(t){return normalizeText(t.categoria_exposicion)===normalizeText(filtrosActivos.categoria);});
    }
    return resultados;
}

function renderizarResultadosBuscador(resultados){
    var container=document.getElementById('buscador-results');
    container.innerHTML='';
    if(!resultados||resultados.length===0){
        container.innerHTML='<div class="buscador-result-empty">Sin resultados</div>';
        container.classList.add('visible');
        return;
    }
    var maxMostrar=Math.min(resultados.length,15);
    for(var i=0;i<maxMostrar;i++){
        var t=resultados[i];
        var nivelClass='nivel-sin-amenaza';
        if(t.nivel_predominante==='Mayor')nivelClass='nivel-mayor';
        else if(t.nivel_predominante==='Menor')nivelClass='nivel-menor';
        var item=document.createElement('div');
        item.className='buscador-result-item'+(territorioSeleccionado&&territorioSeleccionado.id===t.id?' seleccionado':'');
        item.innerHTML='<div class="buscador-resultado-info"><div class="buscador-resultado-nombre">'+(t.nombre_territorio||'Sin nombre')+'</div><div class="buscador-resultado-meta"><span class="buscador-resultado-tipo">'+(t.tipo_territorio||'')+'</span><span>'+(t.canton||'')+'</span></div></div><div class="buscador-resultado-nivel '+nivelClass+'">'+(t.nivel_predominante||'N/A')+'</div>';
        item.setAttribute('data-id',t.id);
        item.addEventListener('click',(function(terr){
            return function(){seleccionarTerritorio(terr);};
        })(t));
        container.appendChild(item);
    }
    if(resultados.length>maxMostrar){
        var more=document.createElement('div');
        more.className='buscador-result-empty';
        more.textContent='... y '+(resultados.length-maxMostrar)+' mas. Sigue escribiendo para filtrar.';
        container.appendChild(more);
    }
    container.classList.add('visible');
}

function seleccionarTerritorio(terr){
    document.getElementById('buscador-results').classList.remove('visible');
    territorioSeleccionado=terr;

    var lyr=buscarCapaPorNombre(terr.nombre_territorio,terr.tipo_territorio);
    if(lyr){
        var popupHtml='';
        try{popupHtml=construirPopupTerritorio(terr);}catch(e){console.error('construirPopupTerritorio error:',e);}
        seleccionarFeatureDeCapa(lyr,{popupHtml:popupHtml,popupOptions:{maxWidth:300,maxHeight:340}});
        actualizarContadorBuscador();
        return;
    }

    limpiarSeleccionAnterior();
    if(!terr.geom||!terr.geom.coordinates){
        document.getElementById('buscador-count').textContent='Sin geometria';
        return;
    }

    var polis=parsearMultiPoligono(terr.geom);
    if(!polis||polis.length===0)return;

    var geom=terr.geom.type==='Polygon'?{type:'Polygon',coordinates:polis[0]}:{type:'MultiPolygon',coordinates:polis};

    var bounds=L.latLngBounds([]);
    function addCoords(coords){
        if(typeof coords[0]==='number'){
            bounds.extend(L.latLng(coords[1],coords[0]));
        }else{
            for(var i=0;i<coords.length;i++)addCoords(coords[i]);
        }
    }
    addCoords(geom.coordinates);

    var popupHtml='';
    try{popupHtml=construirPopupTerritorio(terr);}catch(e){console.error('construirPopupTerritorio error:',e);}

    selectFeature({
        geometry:geom,
        popupHtml:popupHtml,
        popupOptions:{maxWidth:300,maxHeight:340},
        bounds:bounds.isValid()?bounds:null
    });

    actualizarContadorBuscador();
}

function construirPopupTerritorio(t){
    var sH='padding:12px 14px 10px;border-bottom:1px solid #edf0f4;font-family:Inter,sans-serif;';
    var sB='padding:8px 14px 12px;font-family:Inter,sans-serif;';
    var sR='display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;';
    var sL='font-weight:600;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.3px;font-family:Inter,sans-serif;';
    var sV='color:#1a1a2e;font-size:12px;font-weight:500;text-align:right;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:Inter,sans-serif;';
    var sSep='padding:6px 14px 2px;font-family:Inter,sans-serif;font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;border-top:1px solid #e2e8f0;';

    var nivelColor='#16a34a';
    if(t.nivel_predominante==='Mayor')nivelColor='#dc2626';
    else if(t.nivel_predominante==='Menor')nivelColor='#d97706';

    var html='<div style="'+sH+'"><span style="font-size:14px;font-weight:700;color:#1e3a5f;">'+(t.nombre_territorio||'Sin nombre')+'</span></div><div style="'+sB+'">';
    html+='<div style="'+sR+'"><span style="'+sL+'">Tipo</span><span style="'+sV+'">'+(t.tipo_territorio||'-')+'</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Canton</span><span style="'+sV+'">'+(t.canton||'-')+'</span></div>';
    html+='<div style="'+sR+'border-bottom:none;"><span style="'+sL+'">Area total</span><span style="'+sV+'">'+(t.area_total_km2!=null?t.area_total_km2.toFixed(2):'-')+' km2</span></div>';
    html+='</div><div style="'+sSep+'">Distribucion por Nivel de Amenaza</div><div style="'+sB+'">';
    html+='<div style="'+sR+'"><span style="'+sL+'">Area en amenaza mayor</span><span style="'+sV+'">'+(t.area_mayor_km2!=null?t.area_mayor_km2.toFixed(2):'-')+' km2 ('+(t.porcentaje_mayor!=null?t.porcentaje_mayor.toFixed(1):'-')+'%)</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Area en amenaza menor</span><span style="'+sV+'">'+(t.area_menor_km2!=null?t.area_menor_km2.toFixed(2):'-')+' km2 ('+(t.porcentaje_menor!=null?t.porcentaje_menor.toFixed(1):'-')+'%)</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Area expuesta total</span><span style="'+sV+'">'+(t.area_expuesta_km2!=null?t.area_expuesta_km2.toFixed(2):'-')+' km2 ('+(t.porcentaje_expuesto!=null?t.porcentaje_expuesto.toFixed(1):'-')+'%)</span></div>';
    var areaFuera=(t.area_total_km2!=null&&t.area_expuesta_km2!=null)?(t.area_total_km2-t.area_expuesta_km2):null;
    html+='<div style="'+sR+'border-bottom:none;"><span style="'+sL+'">Area fuera de zona de amenaza</span><span style="'+sV+'">'+(areaFuera!=null?areaFuera.toFixed(2):'-')+' km2 ('+(t.porcentaje_fuera!=null?t.porcentaje_fuera.toFixed(1):'-')+'%)</span></div>';
    html+='</div><div style="'+sSep+'">Clasificacion</div><div style="'+sB+'">';
    html+='<div style="'+sR+'"><span style="'+sL+'">Zona de amenaza por lahar</span><span style="'+sV+'color:'+nivelColor+';font-weight:700;">'+(t.nivel_predominante||'-')+'</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Indice de exposicion territorial</span><span style="'+sV+'font-weight:700;">'+(t.indice_exposicion!=null?t.indice_exposicion.toFixed(1):'-')+'</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Nivel de exposicion territorial</span><span style="'+sV+'">'+(t.categoria_exposicion||'-')+'</span></div>';
    html+='<div style="'+sR+'"><span style="'+sL+'">Vias afectadas</span><span style="'+sV+'">'+(t.km_vias_afectadas!=null?t.km_vias_afectadas.toFixed(2):'-')+' km</span></div>';
    html+='<div style="'+sR+'border-bottom:none;"><span style="'+sL+'">Red hidrica afectada</span><span style="'+sV+'">'+(t.km_rios_afectados!=null?t.km_rios_afectados.toFixed(2):'-')+' km</span></div>';
    html+='<button class="buscador-btn-pdf" onclick="exportarTerritorioPDF(\''+t.id+'\')">&#128196; Exportar PDF</button>';
    html+='</div>';
    return html;
}

function exportarTerritorioPDF(id){
    var t=null;
    for(var i=0;i<territoriosDatos.length;i++){
        if(territoriosDatos[i].id==id){t=territoriosDatos[i];break;}
    }
    if(!t)return;

    var nivelColor='#16a34a';
    if(t.nivel_predominante==='Mayor')nivelColor='#dc2626';
    else if(t.nivel_predominante==='Menor')nivelColor='#d97706';

    var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+t.nombre_territorio+'</title>';
    h+='<style>';
    h+='body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;max-width:700px;margin:0 auto;}';
    h+='h1{font-size:20px;text-align:center;margin-bottom:4px;}';
    h+='h2{font-size:12px;text-align:center;color:#64748b;font-weight:normal;margin-top:0;}';
    h+='.date{text-align:center;color:#94a3b8;font-size:11px;margin-bottom:20px;}';
    h+='hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0;}';
    h+='.campo{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;}';
    h+='.campo-label{font-size:12px;color:#475569;}';
    h+='.campo-value{font-size:14px;font-weight:bold;color:#1e3a5f;}';
    h+='.nivel-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:bold;}';
    h+='.nivel-mayor{background:#fef2f2;color:#dc2626;}';
    h+='.nivel-menor{background:#fffbeb;color:#d97706;}';
    h+='.nivel-sin{background:#f0fdf4;color:#16a34a;}';
    h+='.seccion-titulo{font-size:11px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px;padding:8px 0 4px;margin-top:8px;border-top:2px solid #e2e8f0;}';
    h+='.footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;font-style:italic;}';
    h+='</style></head><body>';
    h+='<h1>'+(t.nombre_territorio||'Territorio')+'</h1>';
    h+='<h2>Ficha Territorial - Geoportal Cotopaxi</h2>';
    h+='<div class="date">Generado el '+new Date().toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'})+'</div>';
    h+='<hr>';

    var nc='nivel-sin';
    if(t.nivel_predominante==='Mayor')nc='nivel-mayor';
    else if(t.nivel_predominante==='Menor')nc='nivel-menor';

    h+='<div class="seccion-titulo">Informacion General</div>';
    h+='<div class="campo"><div class="campo-label">Nombre</div><div class="campo-value">'+(t.nombre_territorio||'-')+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Tipo</div><div class="campo-value">'+(t.tipo_territorio||'-')+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Canton</div><div class="campo-value">'+(t.canton||'-')+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Area total</div><div class="campo-value">'+t.area_total_km2.toFixed(2)+' km2</div></div>';

    h+='<div class="seccion-titulo">Distribucion por Nivel de Amenaza</div>';
    h+='<div class="campo"><div class="campo-label">Area en amenaza mayor</div><div class="campo-value">'+t.area_mayor_km2.toFixed(2)+' km2</div></div>';
    h+='<div class="campo"><div class="campo-label">Area en amenaza menor</div><div class="campo-value">'+t.area_menor_km2.toFixed(2)+' km2</div></div>';
    var areaFueraPDF=(t.area_total_km2-t.area_expuesta_km2);
    h+='<div class="campo"><div class="campo-label">Area fuera de zona de amenaza</div><div class="campo-value">'+areaFueraPDF.toFixed(2)+' km2</div></div>';
    h+='<div class="campo"><div class="campo-label">Porcentaje en amenaza mayor</div><div class="campo-value">'+t.porcentaje_mayor.toFixed(1)+'%</div></div>';
    h+='<div class="campo"><div class="campo-label">Porcentaje en amenaza menor</div><div class="campo-value">'+t.porcentaje_menor.toFixed(1)+'%</div></div>';
    h+='<div class="campo"><div class="campo-label">Porcentaje fuera de zona de amenaza</div><div class="campo-value">'+t.porcentaje_fuera.toFixed(1)+'%</div></div>';

    h+='<div class="seccion-titulo">Clasificacion</div>';
    h+='<div class="campo"><div class="campo-label">Zona de amenaza por lahar</div><div class="campo-value"><span class="nivel-badge '+nc+'">'+(t.nivel_predominante||'-')+'</span></div></div>';
    h+='<div class="campo"><div class="campo-label">Indice de exposicion territorial</div><div class="campo-value">'+t.indice_exposicion.toFixed(1)+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Nivel de exposicion territorial</div><div class="campo-value">'+(t.categoria_exposicion||'-')+'</div></div>';
    h+='<div class="campo"><div class="campo-label">Vias afectadas</div><div class="campo-value">'+t.km_vias_afectadas.toFixed(2)+' km</div></div>';
    h+='<div class="campo"><div class="campo-label">Red hidrica afectada</div><div class="campo-value">'+t.km_rios_afectados.toFixed(2)+' km</div></div>';

    h+='<hr>';
    h+='<div class="footer">Geoportal Cotopaxi - Sistema de Informacion Geografica<br>Fuentes: vw_indicadores_cotopaxi, vw_exposicion_cotopaxi | CRS: EPSG:4326 - WGS 84</div>';
    h+='</body></html>';

    var win=window.open('','_blank');
    win.document.write(h);
    win.document.close();
    setTimeout(function(){win.print();},500);
}

function deseleccionarTerritorio(){
    limpiarSeleccionAnterior();
    territorioSeleccionado=null;
    var input=document.getElementById('buscador-input');
    if(input)input.value='';
    var countEl=document.getElementById('buscador-count');
    if(countEl)countEl.textContent=territoriosDatos.length+' total';
}

/* ===== DOMCONTENTLOADED - BUSCADOR ===== */
document.addEventListener('DOMContentLoaded',function(){
    var featureSearchInput=document.getElementById('feature-search-input');
    var featureSearchResults=document.getElementById('feature-search-results');
    if(featureSearchInput){
        var featureTimer=null;
        featureSearchInput.addEventListener('input',function(){
            var val=this.value;
            clearTimeout(featureTimer);
            featureTimer=setTimeout(function(){buscarFeatures(val);},250);
        });
        featureSearchInput.addEventListener('keypress',function(e){
            if(e.key==='Enter')buscarFeatures(this.value);
        });
    }

    var buscadorInput=document.getElementById('buscador-input');
    var buscadorResults=document.getElementById('buscador-results');
    var buscadorTimer=null;

    buscadorInput.addEventListener('input',function(){
        var val=this.value;
        clearTimeout(buscadorTimer);
        buscadorTimer=setTimeout(function(){
            if(!territoriosCargados)return;
            var filtrados=aplicarFiltros(val);
            renderizarResultadosBuscador(filtrados);
            actualizarContadorBuscador();
        },250);
    });

    document.querySelectorAll('.filtro-chip').forEach(function(chip){
        chip.addEventListener('click',function(){
            var grupo=this.getAttribute('data-filtro');
            var valor=this.getAttribute('data-valor');
            if(filtrosActivos[grupo]===valor){
                filtrosActivos[grupo]=null;
                this.classList.remove('activo');
            }else{
                document.querySelectorAll('.filtro-chip[data-filtro="'+grupo+'"]').forEach(function(c){c.classList.remove('activo');});
                filtrosActivos[grupo]=valor;
                this.classList.add('activo');
            }
            buscadorInput.value='';
            var filtrados=aplicarFiltros('');
            renderizarResultadosBuscador(filtrados);
            actualizarContadorBuscador();
        });
    });

    document.addEventListener('click',function(e){
        if(featureSearchResults&&featureSearchInput&&!featureSearchResults.contains(e.target)&&e.target!==featureSearchInput){
            featureSearchResults.classList.remove('visible');
        }
        var tcontainer=document.getElementById('buscador-container');
        if(tcontainer&&!tcontainer.contains(e.target)){
            buscadorResults.classList.remove('visible');
        }
    });

    map.on('click',function(e){
        if(!seleccionandoUbicacion&&!seleccionandoExposicion&&!consultandoAmenaza){
            deseleccionarTerritorio();
        }
    });

    cargarTerritorios();

    var tooltipEl=document.createElement('div');
    tooltipEl.className='ind-info-tooltip';
    document.body.appendChild(tooltipEl);
    document.addEventListener('mouseover',function(e){
        var icon=e.target.closest?e.target.closest('.ind-info-icon'):null;
        if(!icon)return;
        var tt=icon.getAttribute('data-tooltip');
        if(!tt)return;
        tooltipEl.textContent=tt;
        tooltipEl.classList.add('visible');
        var rect=icon.getBoundingClientRect();
        var left=rect.left+rect.width/2-120;
        var top=rect.top-tooltipEl.offsetHeight-8;
        if(left<8)left=8;
        if(left+240>window.innerWidth-8)left=window.innerWidth-248;
        if(top<8)top=rect.bottom+8;
        tooltipEl.style.left=left+'px';
        tooltipEl.style.top=top+'px';
    });
    document.addEventListener('mouseout',function(e){
        var icon=e.target.closest?e.target.closest('.ind-info-icon'):null;
        if(icon)tooltipEl.classList.remove('visible');
    });
});

document.addEventListener('DOMContentLoaded',function(){
    inicializarUI();
    map.on('mousemove',function(e){
        var latEl=document.getElementById('coord-lat');
        var lonEl=document.getElementById('coord-lon');
        if(latEl)latEl.textContent='Lat: '+e.latlng.lat.toFixed(6);
        if(lonEl)lonEl.textContent='Lon: '+e.latlng.lng.toFixed(6);
    });

    map.on('layeradd',function(e){
        if(syncFromLeaflet)return;
        syncFromLeaflet=true;
        if(e.layer===capaReportes){var cb=document.getElementById('toggle-rep');if(cb)cb.checked=true;}
        else if(e.layer===capaExposicion){var cb=document.getElementById('toggle-exp');if(cb)cb.checked=true;}
        else{CAPAS_CONFIG.forEach(function(c,i){if(e.layer===capasCargadas[c.tabla]){var cb=document.querySelector('.capa-toggle[data-index="'+i+'"]');if(cb)cb.checked=true;}});}
        syncFromLeaflet=false;
        actualizarResumen();
    });
    map.on('layerremove',function(e){
        if(syncFromLeaflet)return;
        syncFromLeaflet=true;
        if(e.layer===capaReportes){var cb=document.getElementById('toggle-rep');if(cb)cb.checked=false;}
        else if(e.layer===capaExposicion){var cb=document.getElementById('toggle-exp');if(cb)cb.checked=false;}
        else{CAPAS_CONFIG.forEach(function(c,i){if(e.layer===capasCargadas[c.tabla]){var cb=document.querySelector('.capa-toggle[data-index="'+i+'"]');if(cb)cb.checked=false;}});}
        syncFromLeaflet=false;
        actualizarResumen();
    });

    cargarTodasLasCapas().then(function(){
        cargarReportesExistentes();
        cargarExposicionesExistentes();
    });
});

/* ===================================================================
   DESCARGAR REPORTES - Panel toggle + PDF generation
   =================================================================== */
var panelDescargaAbierto=false;

function togglePanelDescarga(){
    panelDescargaAbierto=!panelDescargaAbierto;
    var panel=document.getElementById('panel-descarga');
    var toggle=document.getElementById('panel-descarga-toggle');
    var arrow=document.getElementById('toggle-arrow-descarga');
    if(panelDescargaAbierto){
        panel.classList.add('abierto');
        toggle.classList.add('activo');
        if(arrow)arrow.classList.add('abierto');
    }else{
        panel.classList.remove('abierto');
        toggle.classList.remove('activo');
        if(arrow)arrow.classList.remove('abierto');
    }
}

function _descargaPDFBase(title,subtitle,headers,rows){
    var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+title+'</title>';
    h+='<style>';
    h+='body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;}';
    h+='h1{font-size:20px;text-align:center;margin-bottom:2px;color:#1e3a5f;}';
    h+='h2{font-size:12px;text-align:center;color:#64748b;font-weight:normal;margin-top:0;}';
    h+='hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0;}';
    h+='table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px;}';
    h+='th{background:#f1f5f9;text-align:left;padding:8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;color:#334155;}';
    h+='td{padding:6px;border-bottom:1px solid #f1f5f9;color:#475569;}';
    h+='tr:nth-child(even){background:#f8fafc;}';
    h+='.badge-count{display:block;text-align:center;font-size:13px;font-weight:bold;color:#fff;background:#0d9488;padding:10px 16px;border-radius:6px;margin:16px 0;letter-spacing:0.5px;}';
    h+='.campo-summary{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;}';
    h+='.campo-summary .label{font-size:11px;color:#475569;}';
    h+='.campo-summary .valor{font-size:12px;font-weight:bold;color:#1e3a5f;}';
    h+='.footer{text-align:center;color:#94a3b8;font-size:9px;margin-top:24px;font-style:italic;border-top:1px solid #e2e8f0;padding-top:12px;}';
    h+='</style></head><body>';
    h+='<h1>Geoportal Cotopaxi</h1>';
    h+='<h2>'+subtitle+'</h2>';
    h+='<hr>';
    h+='<div class="badge-count">'+rows.length+' registro(s) encontrado(s)</div>';
    if(rows.length===0){
        h+='<p style="text-align:center;color:#94a3b8;font-size:12px;">No hay reportes para mostrar.</p>';
    }else{
        h+='<table><thead><tr>';
        for(var c=0;c<headers.length;c++){
            h+='<th>'+headers[c]+'</th>';
        }
        h+='</tr></thead><tbody>';
        for(var r=0;r<rows.length;r++){
            h+='<tr>';
            for(var c2=0;c2<headers.length;c2++){
                var val=rows[r][c2];
                h+='<td>'+(val!==null&&val!==undefined?String(val):'-')+'</td>';
            }
            h+='</tr>';
        }
        h+='</tbody></table>';
    }
    var now=new Date();
    h+='<div class="campo-summary"><div class="label">Fecha de exportacion</div><div class="valor">'+now.toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'})+'</div></div>';
    h+='<div class="campo-summary"><div class="label">Hora de exportacion</div><div class="valor">'+now.toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
    h+='<hr>';
    h+='<div class="footer">Geoportal Cotopaxi - Sistema de Informacion Geografica<br>Fuente: Supabase (reportes_ciudadanos / reportes_exposicion) | CRS: EPSG:4326 - WGS 84<br>Este documento es informativo y no constituye una evacuacion oficial.</div>';
    h+='</body></html>';
    var win=window.open('','_blank');
    win.document.write(h);win.document.close();
    setTimeout(function(){win.print();},500);
}

function _descargaFetch(tabla,orderCol){
    var url=SUPABASE_URL+'/rest/v1/'+tabla+'?select=*&order='+orderCol+'.desc&limit=2000';
    return fetch(url,{headers:{apikey:API_KEY,Authorization:'Bearer '+API_KEY}})
        .then(function(r){
            if(!r.ok)throw new Error('Error '+r.status);
            return r.json();
        });
}

function descargarReportesCiudadanos(){
    _descargaFetch('reportes_ciudadanos','fecha').then(function(data){
        var headers=['ID','Nombre','Categoria','Descripcion','Latitud','Longitud','Estado','Fecha'];
        var rows=[];
        for(var i=0;i<data.length;i++){
            var d=data[i];
            rows.push([
                d.id||'-',
                d.nombre||'-',
                d.categoria||'-',
                d.descripcion||'-',
                d.latitud!=null?parseFloat(d.latitud).toFixed(6):'-',
                d.longitud!=null?parseFloat(d.longitud).toFixed(6):'-',
                d.estado||'-',
                d.fecha||'-'
            ]);
        }
        _descargaPDFBase('Reportes Ciudadanos','Reporte de Reportes Ciudadanos - Cotopaxi',headers,rows);
    }).catch(function(e){
        alert('Error al consultar reportes ciudadanos: '+e.message);
    });
}

function descargarReportesExposicion(){
    _descargaFetch('reportes_exposicion','fecha_reporte').then(function(data){
        var headers=['ID','Tipo Evento','Descripcion','Nivel Afectacion','Fecha Observacion','Fecha Reporte','Latitud','Longitud','Nombre'];
        var rows=[];
        for(var i=0;i<data.length;i++){
            var d=data[i];
            rows.push([
                d.id||'-',
                d.tipo_evento||'-',
                d.descripcion||'-',
                d.nivel_afectacion||'-',
                d.fecha_observacion||'-',
                d.fecha_reporte||'-',
                d.latitud!=null?parseFloat(d.latitud).toFixed(6):'-',
                d.longitud!=null?parseFloat(d.longitud).toFixed(6):'-',
                d.nombre||'-'
            ]);
        }
        _descargaPDFBase('Reportes de Exposicion','Reporte de Exposiciones - Cotopaxi',headers,rows);
    }).catch(function(e){
        alert('Error al consultar reportes de exposicion: '+e.message);
    });
}

function descargarTodosLosReportes(){
    Promise.all([
        _descargaFetch('reportes_ciudadanos','fecha'),
        _descargaFetch('reportes_exposicion','fecha_reporte')
    ]).then(function(results){
        var ciudadanos=results[0];
        var exposicion=results[1];
        var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Todos los Reportes</title>';
        h+='<style>';
        h+='body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;}';
        h+='h1{font-size:20px;text-align:center;margin-bottom:2px;color:#1e3a5f;}';
        h+='h2{font-size:12px;text-align:center;color:#64748b;font-weight:normal;margin-top:0;}';
        h+='h3{font-size:14px;color:#0d9488;margin:20px 0 8px;border-bottom:2px solid #0d9488;padding-bottom:4px;}';
        h+='hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0;}';
        h+='table{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;}';
        h+='th{background:#f1f5f9;text-align:left;padding:7px 5px;border-bottom:2px solid #cbd5e1;font-weight:700;color:#334155;}';
        h+='td{padding:5px;border-bottom:1px solid #f1f5f9;color:#475569;}';
        h+='tr:nth-child(even){background:#f8fafc;}';
        h+='.badge-count{display:inline-block;font-size:11px;font-weight:bold;color:#fff;background:#0d9488;padding:4px 10px;border-radius:12px;margin-left:8px;vertical-align:middle;}';
        h+='.campo-summary{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;}';
        h+='.campo-summary .label{font-size:11px;color:#475569;}';
        h+='.campo-summary .valor{font-size:12px;font-weight:bold;color:#1e3a5f;}';
        h+='.footer{text-align:center;color:#94a3b8;font-size:9px;margin-top:24px;font-style:italic;border-top:1px solid #e2e8f0;padding-top:12px;}';
        h+='</style></head><body>';
        h+='<h1>Geoportal Cotopaxi</h1>';
        h+='<h2>Reporte Consolidado de Todos los Reportes</h2>';
        h+='<hr>';

        // Ciudadanos
        h+='<h3>Reportes Ciudadanos <span class="badge-count">'+ciudadanos.length+'</span></h3>';
        if(ciudadanos.length===0){
            h+='<p style="color:#94a3b8;font-size:11px;">No hay reportes ciudadanos.</p>';
        }else{
            h+='<table><thead><tr><th>ID</th><th>Nombre</th><th>Categoria</th><th>Descripcion</th><th>Lat</th><th>Lon</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>';
            for(var i=0;i<ciudadanos.length;i++){
                var d=ciudadanos[i];
                h+='<tr><td>'+(d.id||'-')+'</td><td>'+(d.nombre||'-')+'</td><td>'+(d.categoria||'-')+'</td><td>'+(d.descripcion||'-')+'</td>';
                h+='<td>'+(d.latitud!=null?parseFloat(d.latitud).toFixed(6):'-')+'</td><td>'+(d.longitud!=null?parseFloat(d.longitud).toFixed(6):'-')+'</td>';
                h+='<td>'+(d.estado||'-')+'</td><td>'+(d.fecha||'-')+'</td></tr>';
            }
            h+='</tbody></table>';
        }

        // Exposicion
        h+='<h3>Reportes de Exposicion <span class="badge-count">'+exposicion.length+'</span></h3>';
        if(exposicion.length===0){
            h+='<p style="color:#94a3b8;font-size:11px;">No hay reportes de exposicion.</p>';
        }else{
            h+='<table><thead><tr><th>ID</th><th>Tipo Evento</th><th>Descripcion</th><th>Nivel</th><th>F. Observ.</th><th>F. Reporte</th><th>Lat</th><th>Lon</th><th>Nombre</th></tr></thead><tbody>';
            for(var j=0;j<exposicion.length;j++){
                var e=exposicion[j];
                h+='<tr><td>'+(e.id||'-')+'</td><td>'+(e.tipo_evento||'-')+'</td><td>'+(e.descripcion||'-')+'</td><td>'+(e.nivel_afectacion||'-')+'</td>';
                h+='<td>'+(e.fecha_observacion||'-')+'</td><td>'+(e.fecha_reporte||'-')+'</td>';
                h+='<td>'+(e.latitud!=null?parseFloat(e.latitud).toFixed(6):'-')+'</td><td>'+(e.longitud!=null?parseFloat(e.longitud).toFixed(6):'-')+'</td>';
                h+='<td>'+(e.nombre||'-')+'</td></tr>';
            }
            h+='</tbody></table>';
        }

        var now=new Date();
        h+='<hr>';
        h+='<div class="campo-summary"><div class="label">Total de registros</div><div class="valor">'+(ciudadanos.length+exposicion.length)+'</div></div>';
        h+='<div class="campo-summary"><div class="label">Fecha de exportacion</div><div class="valor">'+now.toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'})+'</div></div>';
        h+='<div class="campo-summary"><div class="label">Hora de exportacion</div><div class="valor">'+now.toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
        h+='<hr>';
        h+='<div class="footer">Geoportal Cotopaxi - Sistema de Informacion Geografica<br>Fuente: Supabase (reportes_ciudadanos + reportes_exposicion) | CRS: EPSG:4326 - WGS 84<br>Este documento es informativo y no constituye una evacuacion oficial.</div>';
        h+='</body></html>';
        var win=window.open('','_blank');
        win.document.write(h);win.document.close();
        setTimeout(function(){win.print();},500);
    }).catch(function(e){
        alert('Error al consultar reportes: '+e.message);
    });
}
