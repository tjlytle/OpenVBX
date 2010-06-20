var Flows={};Flows.modified=false;Flows.validation=[function(){return{error:false}}];Flows.toggle={speed:1E3,item:function(a){if(!$(a).parent().hasClass("current-item")){$(".current-item a").toggleAnimateToClass("#flowline-items .current-item a","#flowline-items .flowline-item a",this.speed).parent().removeClass("current-item");$(a).toggleAnimateToClass("#flowline-items .current-item a","#flowline-items .flowline-item a",this.speed).parent().addClass("current-item")}}};
Flows.list=function(a){return $(document).data("flow-list")||$(document).data("flow-list",a)};Flows.uniqid=function(){var a=function(){var b=Math.floor(4096+Math.random()*16773119).toString(16),e=Flows.list(),c=$.each(e,function(){if(this.id==b)return false;return true});if(typeof e!="undefined"&&typeof e.length>0&&c)return a();return b};return a()};
Flows.link={tail:function(){var a=Flows.list();return a[a.length-1]},head:function(){return Flows.list()[0]},current:function(){var a=Flows.list(),b=0;$.each($(".flowline-item"),function(){if($(this).hasClass("current-item"))return false;b++;return true});return a[b]},create:function(a,b){var e=Flows.list();b=b||Flows.uniqid();link={id:b,type:a,href:document.location.hash.replace("#flowline","")+"/"+b};e.push(link);$(document).trigger("flow-created",link);return link},pop:function(){var a=Flows.list();
try{var b=a[a.length-1];a.pop();$(document).trigger("flow-popped",b)}catch(e){return false}return true},values:function(a){var b={},e=$(a).find(":input").get();$.each(e,function(){if(this.name&&!this.disabled&&(this.checked||/select|textarea/i.test(this.nodeName)||/text|hidden|password/i.test(this.type))){var c=$(this).val();if(c!=null)switch(typeof b[this.name]){case "string":b[this.name]=new Array(b[this.name]);case "object":b[this.name].push(c);break;default:var d=this.name.match(/^(.*)\[(.+)\]$/);
if(d&&d.length){d=d[1]+"[]";if(typeof b[d]=="undefined")b[d]=[];b[d].push(c)}else b[this.name]=c;break}}});return{name:$(".applet-name:first",a).text(),data:b,id:$(a).attr("id"),type:$(a).attr("rel")}}};
Flows.events={flow:{setName:function(a,b){if($(a.target).attr("id").match(/^prototype-/))return true;$("h2.applet-name",a.target).text(b.substr(0,42));$("#instance-row a[href$="+$(a.target).attr("id")+"] .applet-item-name").text(b.substr(0,42))},beforeSave:function(a,b){a.preventDefault();var e=$("#instances .flow-instance");e=$(".audio-choice .audio-choice-read-text textarea:visible",e);e.length?e.each(function(){Pickers.audio.saveReadText(a,$(this))}).last().queue(function(){$(document).trigger("flow-save",
[b])}):$(document).trigger("flow-save",[b])},save:function(a,b){a.preventDefault();var e=null;$.each(Flows.validation,function(){e=this();if(e.error)return false;return true});if(e&&e.error){$.notify(e.message);return false}var c={};$("#instances .flow-instance").each(function(){c[$(this).attr("id")]=Flows.link.values(this)}).last().queue(function(){var d=$(".vbx-form");params={id:$("input.flow-id",d).val(),name:$("input.flow-name",d).val()};if($(d).hasClass("sms"))params.sms_data=JSON.stringify(c);
if($(d).hasClass("voice"))params.data=JSON.stringify(c);$.ajax({url:OpenVBX.home+"/flows/edit/"+Flows.id,data:params,dataType:"json",success:function(f){if(!f.error){Flows.modified=false;b&&b();return $.notify("Flow has been saved.").flicker()}$.notify(f.message)},type:"POST"});$(this).dequeue()})},copy:function(){$.ajax({url:OpenVBX.home+"/flows/copy/"+Flows.id,data:{name:$("#dialog-save-as input[name=name]").val(),data:JSON.stringify(flow_data)},dataType:"json",success:function(a){if(!a.error)return $.notify("Flow has been copied to "+
a.name).flicker()},type:"POST"})},close:function(a){a=$(a.target).parents(".flow-instance");a=new RegExp("/"+$(a).attr("id")+".*");var b=document.location.hash.match(a);if(b&&b.length>0)b=b[0].split("/");document.location.hash=document.location.hash.replace(a,"");$(document).trigger("hashchange");setTimeout(function(){for(var e in b)b[e].length&&$("#"+b[e]).fadeOut()},600);return false},change:function(){try{var a=document.location.hash;a=a.split("/");var b=a[a.length-1],e={},c=a.length;for(var d in a)try{if(a[d]!=
"#flowline"){var f=$("#"+a[d]);$(f).data("depth",d);e[a[d]]=f}}catch(h){}$(".flow-instance").each(function(){var g=$(this);try{if(!e[g.attr("id")]){var j=$(g).data("depth");if(j<c||j>a.length)g.hide();return true}g.is(":visible")||g.trigger("show")}catch(k){g.hide()}return true});var i=$("#"+b).parents(".instance-cell").get(0);$("#flowline").animate({scrollLeft:i.offsetLeft-$("#flowline").css("width").replace("px","")*0.1,queue:true})}catch(l){$(".flow-instance").hide();$("#start").show()}},created:function(a,
b){Flows.modified=true;a=$(document).data("depth")||0;$(document).data("depth",++a);$("#flowline-items").append('<li class="flowline-item"><a href="#flowline'+b.href+'">'+b.type+"</a></li>")},popped:function(){var a=$(document).data("depth")||0;$(document).data("depth",--a)},shown:function(a){$(a.target).show().removeClass("hide")},select:function(a){var b=$(a.target).hasClass("flow-instance")?$(a.target):$(a.target).parents(".flow-instance");a=new RegExp("^.*"+$(b).attr("id"));try{document.location.hash=
document.location.hash.match(a)[0]}catch(e){var c=document.location.hash;a=c.split("/");var d=a[a.length-1],f=false;$(".flow-instance:visible").each(function(){$(document).trigger("applet-visible",[$(this)]);if($(this).attr("id")==$(b).attr("id"))return false;if(f)c=c+"/"+$(this).attr("id");if($(this).attr("id")==d)f=true;return true});document.location.hash=c+"/"+$(b).attr("id")}$(document).trigger("hashchange")},hidden:function(){}},drag:{},drop:{add:function(a,b){var e=function(){Flows.modified=
true;$(a.target).trigger("click",a);$(".flow-instance:visible").each(function(){var f=false,h=document.location.hash.split("/");for(var i in h)if(h[i]==$(this).attr("id"))f=true;f||$(this).fadeOut("fast")});var c=Flows.link.create($(b.draggable).attr("rel"));$("input",a.target).attr("value",c.href.replace(/^\//,""));var d="plugins/"+c.type.replace(/---/,"/applets/");$(".item-body",a.target).html('<a class="item-box" href="#flowline'+c.href+'"><div class="'+c.type+'-icon applet-icon" style="background: url(\''+
OpenVBX.assets+d+'/icon.png\') no-repeat center center;"><span class="replace">'+c.type+'</span></div><span class="applet-item-name">'+$(".applet-name",b.draggable).text()+'</span></a><div class="flowline-item-remove action-mini remove-mini"><span class="replace">remove</span></div>');$(a.target).addClass("filled-item").removeClass("empty-item");d=$("#prototypes #prototype-"+c.type).html();d=d.replace(/prototype/g,c.id);$("#instance-row").append('<td class="instance-cell"><form><div id="'+c.id+'" class="flow-instance '+
c.type+'" rel="'+c.type+'" style="display: none">'+d+"</div></form></td>");$("#"+c.id+" textarea").text("");$("#"+c.id+" input[type=text]").val("");$("#"+c.id+" .flowline-item").droppable(Flows.events.drop.options);window.location.hash="#flowline"+c.href};$("#dialog-replace-applet").dialog("option","buttons",{OK:function(){e();$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}});if($("input",a.target).attr("value").length>0)return $("#dialog-replace-applet").dialog("open");return e()},
out:function(a){a.preventDefault()},remove:function(a){a.preventDefault();var b=a.target,e=function(){Flows.modified=true;var c=$(b).parents(".flowline-item");c.addClass("empty-item").removeClass("filled-item");var d=$(".item-box",c).attr("href");if(d&&d.length)if(d=d.split("/")){d=d[d.length-1];$("#"+d).remove();delete flow_data[d]}$(".item-body",c).text("Drop applet here");$("input",c).val("")};$("#dialog-remove-applet").dialog("option","buttons",{OK:function(){e();$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}});
$("#dialog-remove-applet").dialog("open");return false},hover:function(){}}};Flows.events.drop.options={accept:".applet-item",hoverClass:"ui-state-active",over:Flows.events.drop.over,out:Flows.events.drop.out,drop:Flows.events.drop.add,helper:"clone"};Flows.events.drag.options={revert:"invalid",snapTolerance:40,hoverClass:"ui-state-active",cursor:"pointer",zIndex:9999,helper:"clone"};
Flows.initialize=function(){$.easing.def="easeInOutExpo";$(".current-item a").data("animated",true);$(".flowline-item a").click(function(){Flows.toggle.item(this)});$("#prototypes textarea").text("");$("#prototypes input[type=text]").val("");$("#dialog-replace-applet").dialog({width:480,buttons:{OK:function(){$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}}});$("#dialog-remove-applet").dialog({width:480,buttons:{OK:function(){$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}}});
$("#dialog-save-as").dialog({width:480,buttons:{OK:function(){$(document).trigger("flow-copy");$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}}});$("#dialog-close").dialog({width:480,buttons:{Yes:function(){$(this).dialog("close")},No:function(){$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}}});$(".navigate-away, .util-menu a, .close-button").live("click",function(){if($(this).attr("href")!=""){var a=$(this).attr("href");if(Flows.modified){$("#dialog-close").dialog("option",
"buttons",{Yes:function(){$(document).trigger("flow-before-save",[function(){document.location=a;$(this).dialog("close")}])},No:function(){document.location=a;$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}});$("#dialog-close").dialog("open");return false}}});$(".applet-item").draggable(Flows.events.drag.options);$(".flowline-item").droppable(Flows.events.drop.options);$(".flow-instance").live("show",Flows.events.flow.shown);$(".flow-instance").live("hide",Flows.events.flow.hidden);
$(".flow-instance").live("click",Flows.events.flow.select);$(".flow-instance").live("set-name",Flows.events.flow.setName);$(".flow-instance .close-flow-instance").live("click",Flows.events.flow.close);$(".flow-instance .flowline-item-remove").live("click",Flows.events.drop.remove);$(document).bind("flow-created",Flows.events.flow.created);$(document).bind("flow-popped",Flows.events.flow.popped);$(document).bind("flow-before-save",Flows.events.flow.beforeSave);$(document).bind("flow-save",Flows.events.flow.save);
$(document).bind("flow-copy",Flows.events.flow.copy);$(".flow-instance").trigger("hide");$(".save-button").click(function(){$(document).trigger("flow-before-save");return false});$(window).bind("hashchange",Flows.events.flow.change);Flows.id=$("#flow-meta .flow-id",document).attr("id").replace("flow-","");Flows.list([]);if(document.location.hash.length<1)document.location.hash="#flowline/start";else $(window).trigger("hashchange");$(".modal-tabs").modalTabs({attr:"rel",history:false});$(".vbx-form").live("submit",
preventDefault);$(":input",$(".vbx-form")).change(function(){Flows.modified=true})};$(document).ready(function(){Flows.initialize()});
