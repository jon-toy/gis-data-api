(window["webpackJsonpfire-contacts"]=window["webpackJsonpfire-contacts"]||[]).push([[0],{100:function(e,t,n){e.exports=n(131)},105:function(e,t,n){},106:function(e,t,n){},131:function(e,t,n){"use strict";n.r(t);var a=n(0),r=n.n(a),o=n(14),c=n.n(o),l=(n(105),n(106),n(170)),i=n(172),u=n(174),s=n(175),m=Object(l.a)((function(e){return{root:{flexGrow:1},menuButton:{marginRight:e.spacing(2)},title:{flexGrow:1}}}));function d(){var e=m();return r.a.createElement("div",{className:e.root},r.a.createElement(i.a,{position:"static"},r.a.createElement(u.a,null,r.a.createElement(s.a,{variant:"h6",className:e.title},"Apache County Fire Contacts"))))}var p=n(16),f=n(26),E=n(55),g=n.n(E),w=n(75),h=n(18),b=n(8),O=n(20),v=n(132),j=n(182),C=n(178),y=n(179),S=n(185),P=n(181),N=n(183),x=n(82),k=n.n(x),R=n(81),A=n.n(R),D=n(83),I=n.n(D),X=n(84),V=n.n(X),L=n(6),M=n(186),G=n(57),H=n.n(G);function z(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function B(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?z(n,!0).forEach((function(t){Object(p.a)(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):z(n).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}var T={add:function(e){var t=e.onExecute;return r.a.createElement("div",{style:{textAlign:"center"}},r.a.createElement(j.a,{color:"primary",onClick:t,title:"Create new row"},"New"))},edit:function(e){var t=e.onExecute;return r.a.createElement(C.a,{onClick:t,title:"Edit row"},r.a.createElement(A.a,null))},delete:function(e){var t=e.onExecute;return r.a.createElement(C.a,{onClick:function(){window.confirm("Are you sure you want to delete this row?")&&t()},title:"Delete row"},r.a.createElement(k.a,null))},commit:function(e){var t=e.onExecute;return r.a.createElement(C.a,{onClick:t,title:"Save changes"},r.a.createElement(I.a,null))},cancel:function(e){var t=e.onExecute;return r.a.createElement(C.a,{color:"secondary",onClick:t,title:"Cancel changes"},r.a.createElement(V.a,null))}},W=function(e){var t=e.id,n=e.onExecute,a=T[t];return r.a.createElement(a,{onExecute:n})},$={department:["DISPATCH","ALPINE","EAGAR","GREER","VERNON","DEV"],type:["EMAIL","PHONE"]},F=Object(L.a)((function(e){return{lookupEditCell:{padding:e.spacing(1)},dialog:{width:"calc(100% - 16px)"},inputRoot:{width:"100%"},textField:{marginLeft:e.spacing(1),marginRight:e.spacing(1),width:"100%"}}}),{name:"ControlledModeDemo"})((function(e){var t=e.availableColumnValues,n=e.value,a=e.onValueChange,o=e.classes;return r.a.createElement(N.a,{className:o.lookupEditCell},r.a.createElement(S.a,{value:n,onChange:function(e){return a(e.target.value)},input:r.a.createElement(y.a,{classes:{root:o.inputRoot}})},t.map((function(e){return r.a.createElement(P.a,{key:e,value:e},e)}))))})),J=function(e){return r.a.createElement(O.d.Cell,e)},U=function(e){var t=e.column,n=$[t.name];return n?r.a.createElement(F,Object.assign({},e,{availableColumnValues:n})):r.a.createElement(O.g.Cell,e)},Y=function(e){return e.id},_=function(){var e=Object(a.useState)([{name:"department",title:"Department"},{name:"name",title:"Name"},{name:"type",title:"Type"},{name:"value",title:"Value"}]),t=Object(h.a)(e,1)[0],n=Object(a.useState)([]),o=Object(h.a)(n,2),c=o[0],l=o[1];Object(a.useEffect)((function(){(function(){var e=Object(w.a)(g.a.mark((function e(){var t;return g.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,H()("https://apachecountyfirecontact.firebaseio.com/fire/contacts.json");case 2:t=e.sent,l(t.data);case 4:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}})()()}),[]);var i=Object(a.useState)({password:""}),u=Object(h.a)(i,2),s=u[0],m=u[1],d=Object(a.useState)([{columnName:"department"},{columnName:"name"},{columnName:"type"},{columnName:"value"}]),p=Object(h.a)(d,1)[0],E=Object(a.useState)([{columnName:"department",direction:"asc"}]),j=Object(h.a)(E,2),C=j[0],y=j[1],S=Object(a.useState)([]),P=Object(h.a)(S,2),N=P[0],x=P[1],k=Object(a.useState)([]),R=Object(h.a)(k,2),A=R[0],D=R[1],I=Object(a.useState)({}),X=Object(h.a)(I,2),V=X[0],L=X[1],G=Object(a.useState)(0),z=Object(h.a)(G,2),T=z[0],F=z[1],_=Object(a.useState)(0),q=Object(h.a)(_,2),K=q[0],Q=q[1],Z=Object(a.useState)([5,10,0]),ee=Object(h.a)(Z,1)[0],te=Object(a.useState)(["department","name","type","value"]),ne=Object(h.a)(te,2),ae=ne[0],re=ne[1],oe=Object(a.useState)([O.f.COLUMN_TYPE]),ce=Object(h.a)(oe,1)[0],le=function(e){H.a.post("/fire-contacts/contacts",e).then((function(e){console.log(e)})).catch((function(t){console.log(t),console.log(e)}))};return r.a.createElement(v.a,null,r.a.createElement(O.b,{rows:c,columns:t,getRowId:Y},r.a.createElement(M.a,{id:"password",label:"Enter Password",value:s.password,onChange:function(e){m({password:e.target.value})},fullWidth:!0,type:"password"}),r.a.createElement(b.k,{sorting:C,onSortingChange:y}),r.a.createElement(b.i,{currentPage:T,onCurrentPageChange:F,pageSize:K,onPageSizeChange:Q}),r.a.createElement(b.c,{editingRowIds:N,onEditingRowIdsChange:x,rowChanges:V,onRowChangesChange:L,addedRows:A,onAddedRowsChange:function(e){return D(e.map((function(e){return Object.keys(e).length?e:{department:$.department[0],name:"",type:$.type[0],value:""}})))},onCommitChanges:function(e){var t=e.added,n=e.changed,a=e.deleted;if(console.log(s.password),"apachecounty123"===s.password){var r;if(t){var o=c.length>0?c[c.length-1].id+1:0;r=[].concat(Object(f.a)(c),Object(f.a)(t.map((function(e,t){return B({id:o+t},e)}))))}n&&(r=c.map((function(e){return n[e.id]?B({},e,{},n[e.id]):e}))),a&&(r=function(e){var t=c.slice();return e.forEach((function(e){var n=t.findIndex((function(t){return t.id===e}));n>-1&&t.splice(n,1)})),t}(a)),(r=r.map((function(e){if("PHONE"===e.type){var t=B({},e,{value:e.value.replace(/[^0-9]/g,"")});return console.log(t),t}return e}))).filter((function(e){return"EMAIL"===e.type&&!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(e.value)||"PHONE"===e.type&&!/^\d{10}$/.test(e.value)})).length>0?alert("Invalid Entry. Phone Numbers should be 10 digits, and Email Addresses should be XXXX@XXXX.COM"):(l(r),le(r))}else alert("Please enter the correct password to modify this table.")}}),r.a.createElement(b.g,null),r.a.createElement(b.f,null),r.a.createElement(O.a,null),r.a.createElement(O.d,{columnExtensions:p,cellComponent:J}),r.a.createElement(O.e,{order:ae,onOrderChange:re}),r.a.createElement(O.i,{showSortingControls:!0}),r.a.createElement(O.g,{cellComponent:U}),r.a.createElement(O.f,{width:170,showAddCommand:!A.length,showEditCommand:!0,showDeleteCommand:!0,commandComponent:W}),r.a.createElement(O.h,{leftColumns:ce}),r.a.createElement(O.c,{pageSizes:ee})))};var q=function(){return r.a.createElement("div",{className:"App"},r.a.createElement(d,null),r.a.createElement(_,null))};Boolean("localhost"===window.location.hostname||"[::1]"===window.location.hostname||window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));c.a.render(r.a.createElement(q,null),document.getElementById("root")),"serviceWorker"in navigator&&navigator.serviceWorker.ready.then((function(e){e.unregister()}))}},[[100,1,2]]]);
//# sourceMappingURL=main.dbcce2a7.chunk.js.map