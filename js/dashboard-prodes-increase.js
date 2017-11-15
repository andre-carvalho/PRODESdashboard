var utils = {
	config:{},
	printWindow:null,
	statusPrint:false,
	cssDefault:true,
	setConfig: function(config) {
		utils.config=config;
	},
	onResize:function(event) {
		clearTimeout(utils.config.resizeTimeout);
		utils.config.resizeTimeout = setTimeout(utils.rebuildAll, 200);
	},
	updateDimensions: function() {
		var d={w: window.innerWidth,
				h: window.innerHeight};
		graph.setDimensions(d);
	},
	rebuildAll: function() {
		utils.updateDimensions();
		graph.updateChartsDimensions();
	},
	setTitle:function(elementId, title) {
		elementId='title-chart-by-'+elementId;
		document.getElementById(elementId).innerHTML=title;
	},
	/**
	 * anArray contains the array of objects gathering from crossfilter group.
	 * substring is string that you want
	 */
	findInArray:function(anArray,substring) {
		substring=substring.toLowerCase();
		var found = $.grep( anArray, function ( value, i) {
			return (value.key.toLowerCase().indexOf(substring) >= 0)
		 });
		 return found;
	},
	searchCounty:function(){
		var r=utils.findInArray(graph.munGroup.all(), $('#search-county')[0].value);
		if(r.length==1) {
			utils.selectedItem(r[0].key,r[0].value);
		}else{
			this.showFilteredItems(r);
		}
	},
	showFilteredItems: function(r) {
		(r.length==0)?($('#txt1h').hide()):($('#txt1h').show());
		document.getElementById("filtered-list").innerHTML=(r.length==0)?(Translation[Lang.language].not_found):("");
		r.forEach(function(o){
			var m=o.key.replace("'","´");
			document.getElementById("filtered-list").innerHTML+="<li><a href=\"javascript:utils.selectedItem('"+m+"',"+o.value+");\">"+m+"</a></li>";
		});
		$('#modal-container-filtered').modal('show');
	},
	selectedItem: function(key,value) {
		$('#modal-container-filtered').modal('hide');
		graph.applyCountyFilter([{key:key.replace("´","'"),value:value}]);
	},
	totalRateCalculator: function() {
		var itens=graph.ufAreaMunGroup.top(Infinity);
		var t=0;
		itens.forEach(function(d){
			t+=d.value;
		});
		return t;
	},
	/*
	 * Remove numeric values less than 1e-6
	 */
	snapToZero:function(sourceGroup) {
		return {
			all:function () {
				return sourceGroup.all().map(function(d) {
					return {key:d.key,value:( (Math.abs(d.value)<1e-6) ? 0 : d.value )};
				});
			},
			top: function(n) {
				return sourceGroup.top(Infinity)
					.filter(function(d){
						return (Math.abs(d.value)>1e-6);
						})
					.slice(0, n);
			}
		};
	},
	getMunOrder: function() {
		var allTop=graph.munAreaMunGroup.top(Infinity);
		var ar={};
		allTop.forEach(function(k,i){ar["\""+k.key+"\""]=(i+1);});
		return ar;
	},
	getUCOrder: function() {
		var allTop=graph.ucAreaUcGroup.top(Infinity);
		var ar={};
		allTop.forEach(function(k,i){ar["\""+k.key+"\""]=(i+1);});
		return ar;
	},
	addGenerationDate: function() {
		var footer_page=document.getElementById("footer_page");
		var footer_print=document.getElementById("footer_print");
		if(!footer_page || !footer_print) {
			return;
		}
		var h=( (window.document.body.clientHeight>window.innerHeight)?(window.document.body.clientHeight):(window.innerHeight - 20) );
		footer_page.style.display='block';
		footer_print.style.width=window.innerWidth+"px";
		var now=new Date();
		var footer=Translation[Lang.language].footer1+' '+now.toLocaleString()+' '+Translation[Lang.language].footer2;
		footer_page.innerHTML=footer;
		footer_print.innerHTML=footer;
	},
	/**
	 * Apply configurations to UI
	 * - Enable or disable the information about rates estimate.
	 * - Enable or disable the panel swap button.
	 */
	applyConfigurations: function() {
		document.getElementById("panel_swap").style.display=( (graph.displaySwapPanelButton)?(''):('none') );
	},
	changeCss: function(bt) {
		utils.cssDefault=!utils.cssDefault;
		document.getElementById('stylesheet_dark').href=((utils.cssDefault)?(''):('./css/dashboard-prodes-increase-dark.css'));
		bt.style.display='none';
		setTimeout(function(){bt.style.display='';},200);
	},
	loadingShow: function(ctl) {
		d3.select('#panel_container').style('display', (ctl)?('none'):(''));
		d3.select('#display_loading').style('display',(ctl)?('block'):('none'));
		document.getElementById("inner_display_loading").innerHTML=(ctl)?
		('<span id="animateIcon" class="glyphicon glyphicon-refresh glyphicon-refresh-animate" aria-hidden="true"></span>'):('');
	},
	displayError:function(error) {
		d3.select('#panel_container').style('display','none');
		d3.select('#display_error').style('display','block');
		document.getElementById("inner_display_error").innerHTML=Translation[Lang.language].failure_load_data+
		'<span id="dtn_refresh" class="glyphicon glyphicon-refresh" aria-hidden="true" title="'+Translation[Lang.language].refresh_data+'"></span>';
		setTimeout(function(){
			d3.select('#dtn_refresh').on('click', function() {
				window.location.reload();
		    });
		}, 300);
	},
	displayNoData:function() {
		this.displayError(Translation[Lang.language].no_data);
	},
	displayGraphContainer:function() {
		d3.select('#panel_container').style('display','block');
	}
};

var graph={

	barAreaByYear: null,
	pieTotalizedByState: null,
	rowTop10ByMun: null,
	rowTop10ByUc: null,

	yearDimension: null,
	ufDimension: null,
	munDimension: null,
	ucDimension: null,
	yearAreaMunGroup: null,
	ufAreaMunGroup: null,
	ucAreaUcGroup: null,
	munAreaMunGroup: null,
	munGroup: null,
	
	data:null,
	
	winWidth: window.innerWidth,
	winHeight: window.innerHeight,
	
	histogramColor: "#ffd700",
	darkHistogramColor: "#ffd700",
	pallet: ["#FF0000","#FF6A00","#FF8C00","#FFA500","#FFD700","#FFFF00","#DA70D6","#BA55D3","#7B68EE"],
	darkPallet: ["#FF0000","#FF6A00","#FF8C00","#FFA500","#FFD700","#FFFF00","#DA70D6","#BA55D3","#7B68EE"],
	barTop10Color: "#b8b8b8",
	darkBarTop10Color: "#c9c9c9",
	displayInfo: false,
	displaySwapPanelButton: false,
	
	/**
	 * Load configuration file before loading data.
	 */
	loadConfigurations: function(callback) {
		graph.readConfigurationWithCallback(null, callback, config_increase);
	},
	readConfigurationWithCallback: function(error, callback, conf) {		
		if (error) {
			console.log("Didn't load config file. Using default options.");
		}else {
			if(conf) {
				graph.pallet=conf.pallet?conf.pallet:graph.pallet;
				graph.darkPallet=conf.darkPallet?conf.darkPallet:graph.darkPallet;
				graph.histogramColor=conf.histogramColor?conf.histogramColor:graph.histogramColor;
				graph.darkHistogramColor=conf.darkHistogramColor?conf.darkHistogramColor:graph.darkHistogramColor;
				graph.barTop10Color=conf.barTop10Color?conf.barTop10Color:graph.barTop10Color;
				graph.darkBarTop10Color=conf.darkBarTop10Color?conf.darkBarTop10Color:graph.darkBarTop10Color;
				graph.displayInfo=conf.displayInfo?conf.displayInfo:graph.displayInfo;
				graph.displaySwapPanelButton=conf.displaySwapPanelButton?conf.displaySwapPanelButton:graph.displaySwapPanelButton;
			}
			utils.applyConfigurations();
		}
		callback();
	},
	setDimensions: function(dim) {
		this.winWidth=dim.w;
		this.winHeight=dim.h;
	},
	updateChartsDimensions: function() {
		var w=parseInt(this.winWidth - (this.winWidth * 0.05)),
		h=parseInt(this.winHeight * 0.3),
		minWidth=250, maxWidth=600, fw=parseInt((w)/2),
		fh=parseInt((this.winHeight - h) * 0.5);
		// define min width to filter graphs
		fw=((fw<minWidth)?(minWidth):(fw));
		// define max width to filter graphs
		fw=((fw>maxWidth)?(maxWidth):(fw));

		// to single column in main container
		var chartByYear=document.getElementById('chart-by-year')
		if((chartByYear.clientWidth*2) > window.document.body.clientWidth) {
			fw = chartByYear.clientWidth;
		}

		this.barAreaByYear
			.width(fw)
			.height(fh);
		this.barAreaByYear.margins().left = 60;

		this.pieTotalizedByState
			.width(fw)
			.height(fh);
		this.rowTop10ByMun
			.width(fw)
			.height(fh);
		this.rowTop10ByUc
			.width(fw)
			.height(fh);
		
		dc.renderAll();
	},
	setChartReferencies: function() {
		
		this.barAreaByYear = dc.barChart("#chart-by-year");
		this.pieTotalizedByState = dc.pieChart("#chart-by-state");
		this.rowTop10ByMun = dc.rowChart("#chart-by-mun");
		this.rowTop10ByUc = dc.rowChart("#chart-by-uc");
	},
	loadData: function() {
		utils.loadingShow(true);
		
		// Download the deforestation data from PRODES WFS service.
		// http://terrabrasilis.info/fip-service/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=fip-project-prodes:prodes_d&outputFormat=application%2Fjson
		
		//d3.json("data/prodes.json", graph.processData);
		graph.processData(null, prodes_increase_file);
	},
	processData: function(error, data) {
		utils.loadingShow(false);
		if (error) {
			utils.displayError( error );
			return;
		}else if(!data) {
			utils.displayNoData();
			return;
		}else {
			utils.displayGraphContainer();
		
			var o=[],csv=[];
			for (var j = 0, n = data.totalFeatures; j < n; ++j) {
				var fet=data.features[j];
				var uc=(fet.properties.j)?(fet.properties.j+"/"+fet.properties.h):(null)
				o.push({
					year:+fet.properties.g,
					aTotal:+fet.properties.d,
					aMun:+fet.properties.e,
					aUc:+fet.properties.f,
					uf:fet.properties.h,
					mun:fet.properties.i+"/"+fet.properties.h,
					uc:uc,
					cl:fet.properties.c
				});
				csv.push({
					year:+fet.properties.g,
					areaTotal:+fet.properties.d,
					areaMun:+fet.properties.e,
					areaUc:+fet.properties.f,
					uf:fet.properties.h,
					municipio:fet.properties.i,
					uc:fet.properties.j,
					classe:fet.properties.c
				});
			}
			data = o;
			graph.data=data;
			graph.data2csv=csv;
			graph.registerDataOnCrossfilter(data);
			graph.build();
		}
	},
	registerDataOnCrossfilter: function(data) {
		var ndx = crossfilter(data);

		this.yearDimension = ndx.dimension(function(d) {
			return d.year;
		});
		this.ufDimension = ndx.dimension(function(d) {
			return d.uf;
		});
		this.munDimension = ndx.dimension(function(d) {
			return d.mun;
		});
		this.ucDimension = ndx.dimension(function(d) {
			return ((d.uc)?(d.uc):('null'));
		});
		
		this.yearAreaMunGroup = this.yearDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});
		this.ufAreaMunGroup = this.ufDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});
		this.ucAreaUcGroup = this.ucDimension.group().reduceSum(function(d) {
			return +d.aUc;
		});
		this.munAreaMunGroup = this.munDimension.group().reduceSum(function(d) {
			return +d.aMun;
		});

		this.munGroup = this.munDimension.group().reduceCount(function(d) {return d;})
		
	},
	applyCountyFilter: function(d){
		if(!d || !d.length) {
			this.rowTop10ByMun.data(function (group) {
				var fakeGroup=[];
				fakeGroup.push({key:Translation[Lang.language].no_value,value:0});
				return (group.all().length>0)?(group.top(10)):(fakeGroup);
			});
		}else{
			this.rowTop10ByMun.data(function (group) {
				var filteredGroup=[], index,allItems=group.top(Infinity);
				allItems.findIndex(function(item,i){
					if(item.key==d[0].key){
						index=i;
						filteredGroup.push({key:item.key,value:item.value});
					}
				});
				var ctl=1,max=[],min=[];
				while (ctl<=5) {
					var item=allItems[index+ctl];
					if(item) min.push({key:item.key,value:item.value});
					item=allItems[index-ctl];
					if(item) max.push({key:item.key,value:item.value});
					++ctl;
				}
				filteredGroup=filteredGroup.concat(max);
				min.reverse();
				filteredGroup=min.concat(filteredGroup);
				filteredGroup.reverse();
				return filteredGroup;
			});
			this.rowTop10ByMun.filterAll();
			this.rowTop10ByMun.filter(d[0].key);
		}
		dc.redrawAll();
	},
	build: function() {

		this.setChartReferencies();

		utils.setTitle('year',Translation[Lang.language].barTitle);
		
		this.barAreaByYear
			.yAxisLabel(Translation[Lang.language].barYAxis)
			.xAxisLabel(Translation[Lang.language].barXAxis)
			.dimension(this.yearDimension)
			.group(utils.snapToZero(this.yearAreaMunGroup))
			.title(function(d) {
				return Translation[Lang.language].area + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				var v=Math.round(d.data.value);
				return localeBR.numberFormat(',1f')( (v>0)?(v):(d.data.value.toFixed(2)) ) + " km²";
			})
			.elasticY(true)
			.yAxisPadding('10%')
			.x(d3.scale.ordinal())
	        .xUnits(dc.units.ordinal)
	        .barPadding(0.2)
			.outerPadding(0.1)
			.renderHorizontalGridLines(true)
			.ordinalColors([(utils.cssDefault)?(graph.histogramColor):(graph.darkHistogramColor)]);
	
		utils.setTitle('state',Translation[Lang.language].pieTitle);
		
		this.pieTotalizedByState
			.innerRadius(10)
			.externalRadiusPadding(30)
			.dimension(this.ufDimension)
			.group(utils.snapToZero(this.ufAreaMunGroup))
			.title(function(d) {
				var t=utils.totalRateCalculator();
				t = Translation[Lang.language].percent + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %";
				t = Translation[Lang.language].state + d.key + "\n" + t + "\n";
				return t + Translation[Lang.language].area + localeBR.numberFormat(',1f')(Math.abs(+(d.value.toFixed(2)))) + " km²";
			})
			.label(function(d) {
				var filters = graph.pieTotalizedByState.filters();
				var localized = false;
				
				for(var f = 0; f < filters.length; f++){
					if(filters[f] === d.key) localized = true; 
				}
				
				var t=utils.totalRateCalculator();

				if(filters.length == 0){
					return d.key + ":" + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %";
				} else {
					return localized === true ? d.key + ":" + localeBR.numberFormat(',1f')((d.value * 100 / t).toFixed(1)) + " %" : "";
				}
			})
			.ordering(dc.pluck('key'))
			.ordinalColors((utils.cssDefault)?(graph.pallet):(graph.darkPallet))
			.legend(dc.legend());

		
		utils.setTitle('mun',Translation[Lang.language].rowMunTitle);

		var barHeightAdjust=function (chart) {
			if(chart.data().length > 5){
				chart.fixedBarHeight(false);
			}else{
				chart.fixedBarHeight( parseInt((chart.effectiveHeight()*0.7)/10) );
			}
		};
		
		this.rowTop10ByMun
			.dimension(this.munDimension)
			.group(utils.snapToZero(this.munAreaMunGroup))
			.title(function(d) {
				return Translation[Lang.language].county + "/" + Translation[Lang.language].state + d.key + "\n" +
				Translation[Lang.language].area + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				return d.key + ": " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";;
			})
			.elasticX(true)
			.ordinalColors([(utils.cssDefault)?(graph.barTop10Color):(graph.darkBarTop10Color)])
			.ordering(function(d) {
				return d.value;
			})
			.controlsUseVisibility(true);
		
		this.rowTop10ByMun.data(function (group) {
			var fakeGroup=[];
			fakeGroup.push({key:Translation[Lang.language].no_value,value:0});
			return (group.all().length>0)?(group.top(10)):(fakeGroup);
		});

		this.rowTop10ByMun.xAxis().tickFormat(function(d) {
			return d;
		}).ticks(5);

		this.rowTop10ByMun.on("preRedraw", barHeightAdjust);
		this.rowTop10ByMun.removeFilterHandler(function(filters, filter) {
			var pos=filters.indexOf(filter);
			filters.splice(pos,1);
			if(!filters.length) {
				graph.applyCountyFilter(null);
			}
			return filters;
		});

		this.rowTop10ByMun.on("renderlet.a",function (chart) {
			var texts=chart.selectAll('g.row text');
			var rankMun=utils.getMunOrder();
			texts[0].forEach(function(t){
				var p=(rankMun["\""+t.innerHTML.split(":")[0]+"\""])?(rankMun["\""+t.innerHTML.split(":")[0]+"\""]+'º - '):('');
				t.innerHTML=p+t.innerHTML;
			});
		});
		
		utils.setTitle('uc',Translation[Lang.language].rowUcTitle);

		this.rowTop10ByUc
			.dimension(this.ucDimension)
			.group(utils.snapToZero(this.ucAreaUcGroup))
			.title(function(d) {
				return Translation[Lang.language].protectedArea + "/" + Translation[Lang.language].state + d.key + "\n" +
				Translation[Lang.language].area + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.label(function(d) {
				return d.key + ": " + localeBR.numberFormat(',1f')(d.value.toFixed(2)) + " km²";
			})
			.elasticX(true)
			.ordinalColors([(utils.cssDefault)?(graph.barTop10Color):(graph.darkBarTop10Color)])
			.ordering(function(d) {
				return d.value;
			})
			.controlsUseVisibility(true);
		
		this.rowTop10ByUc.data(function (group) {
			var fakeGroup=[];
			fakeGroup.push({key:Translation[Lang.language].no_value,value:0});
			return (group.top(10).length>0)?(group.top(10)):(fakeGroup);
		});
		
		this.rowTop10ByUc.on("preRedraw", barHeightAdjust);

		this.rowTop10ByUc.xAxis().tickFormat(function(d) {
			return d;
		}).ticks(5);

		this.rowTop10ByUc.on("renderlet.a",function (chart) {
			var texts=chart.selectAll('g.row text');
			var rankUCs=utils.getUCOrder();
			texts[0].forEach(function(t){
				var p=(rankUCs["\""+t.innerHTML.split(":")[0]+"\""])?(rankUCs["\""+t.innerHTML.split(":")[0]+"\""]+'º - '):('');
				t.innerHTML=p+t.innerHTML;
			});
		});
		
		this.updateChartsDimensions();
		utils.addGenerationDate();
		this.prepareTools();
	},
	init: function() {
		window.onresize=utils.onResize;
		this.loadConfigurations(function(){
			try{
				graph.loadData();
			}catch (e) {
				utils.displayLoadError(e);
			}
		});
	},
	/*
	 * Called from the UI controls to clear one specific filter.
	 */
	resetFilter: function(who) {
		if(who=='year'){
			graph.barAreaByYear.filterAll();
		}else if(who=='state'){
			graph.pieTotalizedByState.filterAll();
		}else if(who=='mun'){
			graph.rowTop10ByMun.filterAll();
			graph.applyCountyFilter(null);
		}else if(who=='uc'){
			graph.rowTop10ByUc.filterAll();
		}
		dc.redrawAll();
	},
	prepareTools: function() {
		// build download data
		d3.select('#download-csv')
	    .on('click', function() {

			var filteredData=graph.yearDimension.top(Infinity),
			csv=[];
			filteredData.forEach(function(d) {
				var m=d.mun.split("/"),
				u=(d.uc)?(d.uc.split("/")):(null);
				csv.push({
					year:d.year,
					areaTotal:d.aTotal,
					areaMun:d.aMun,
					areaUc:d.aUc,
					uf:d.uf,
					municipio:m[0],
					uc:(u)?(u[0]):(''),
					classe:d.cl
				});
			});
	        var blob = new Blob([d3.csv.format(csv)], {type: "text/csv;charset=utf-8"});
	        var dt=new Date();
	    	dt=dt.getDate() + "_" + dt.getMonth() + "_" + dt.getFullYear() + "_" + dt.getTime();
	        saveAs(blob, 'prodes_increase_filtered_'+dt+'.csv');
		});

		d3.select('#download-csv-all')
	    .on('click', function() {

	        var blob = new Blob([d3.csv.format(graph.data2csv)], {type: "text/csv;charset=utf-8"});
	        var dt=new Date();
	    	dt=dt.getDate() + "_" + dt.getMonth() + "_" + dt.getFullYear() + "_" + dt.getTime();
	        saveAs(blob, 'prodes_increase_'+dt+'.csv');
	    });
		
		d3.select('#prepare_print')
	    .on('click', function() {
	    	graph.preparePrint();
	    });
		
		d3.select('#change_style')
	    .on('click', function() {
	    	utils.changeCss(this);
	    	graph.build();
	    });
		
		d3.select('#panel_swap')
	    .on('click', function() {
	    	window.location='?type=rates';
	    });
		
		this.jsLanguageChange();
	},
	preparePrint: function() {
		d3.select('#print_information').style('display','block');
		d3.select('#print_page')
	    .on('click', function() {
	    	d3.select('#print_information').style('display','none');
	    	window.print();
	    });
	},
	jsLanguageChange: function() {
		var callback = function() {
			graph.build();
		};
		d3.select('#flag-pt-br')
	    .on('click', function() {
	    	Lang.change('pt-br', callback);
	    });
		d3.select('#flag-en')
	    .on('click', function() {
	    	Lang.change('en', callback);
	    });
		d3.select('#flag-es')
	    .on('click', function() {
	    	Lang.change('es', callback);
	    });
	}
};

window.init=function(){
	Mousetrap.bind(['command+p', 'ctrl+p'], function() {
        console.log('command p or control p');
        // return false to prevent default browser behavior
        // and stop event from bubbling
        return false;
    });
	$(function() {
		$('#chart1').hover(function() {
			$('#dwn1').fadeIn();
		}, function() {
			$('#dwn1').fadeOut();
		});
		$('#chart2').hover(function() {
			$('#dwn2').fadeIn();
		}, function() {
			$('#dwn2').fadeOut();
		});
		$('#chart3').hover(function() {
			$('#dwn3').fadeIn();
		}, function() {
			$('#dwn3').fadeOut();
		});
		$('#chart3').hover(function() {
			$('#txt2a').fadeIn();
		}, function() {
			$('#txt2a').fadeOut();
		});
		$('#chart4').hover(function() {
			$('#dwn4').fadeIn();
		}, function() {
			$('#dwn4').fadeOut();
		});
	});
};

window.onload=function(){
	window.init();
	Lang.init();
	graph.init();
	Lang.apply();// apply from previous selection
};