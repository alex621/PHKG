function InsertText( text, splittable ) {
	var TextArea = $("textarea").get(0);
	var l;
	if (TextArea) {
		TextArea.focus();
		if (splittable)
			l = text.split(/,/);
		else
			l = text
			
		if ((typeof TextArea.selectionStart) != 'undefined') {	// Mozilla
			var ti = TextArea.selectionEnd, ts = TextArea.selectionStart;	// Copied from the Glomerulus
			if (l instanceof Array) {
				if (ti != ts) {
					TextArea.value = TextArea.value.substring(0, ts) + l[0] + TextArea.value.substring(ts, ti) + l[2] + TextArea.value.substr(ti);
					TextArea.selectionStart = ts + l[0].length
					TextArea.selectionEnd = ti + l[2].length - 1;
				} else {
					TextArea.value = TextArea.value.substring(0, ts) + l[0] + l[1] + l[2] + TextArea.value.substr(ti);
					TextArea.selectionStart = ti + l[0].length;
					TextArea.selectionEnd = TextArea.selectionStart + l[1].length;
				}
			} else {
				TextArea.value = TextArea.value.substring(0, ts) + l + " " + TextArea.value.substr(ti);
				TextArea.selectionStart = TextArea.selectionEnd = ti + l.length + 1;
			}
		} else if (document.selection) {						// IE
			var r = document.selection.createRange();			// No Glomerulus here ;-(
			if (l instanceof Array) {
				if (r.text != "")
					r.text = l[0] + r.text + l[2];
				else
					r.text = l[0] + l[1] + l[2];
			} else
				r.text = l + " ";
			//r.select();										// Useless
		} else {												// Neither.
			TextArea.value += text + " ";
		}
		TextArea.focus();
	}
	//return false;
}

function InsertList() {
	var lll = "[list]\n[*]第一項[/*]\n[*]第二項[/*]\n[*]第三項[/*]\n[/list]";
	var TextArea = $("textarea").get(0);
	if (TextArea) {
		TextArea.focus();
		if ((typeof TextArea.selectionStart) != 'undefined') {	// Mozilla
			var ti = TextArea.selectionEnd, ts = TextArea.selectionStart;
			if (ti != ts) {
				TextArea.value = TextArea.value.substring(0, ts) + "[*]" + TextArea.value.substring(ts, ti) + "[/*]" + TextArea.value.substr(ti);
				TextArea.selectionEnd = ti + 7;
			} else {
				TextArea.value = TextArea.value.substring(0, ts) + lll + TextArea.value.substr(ti);
				TextArea.selectionEnd = ti + lll.length;
			}
			TextArea.selectionStart = ts;
		} else if (document.selection) {						// IE
			var r = document.selection.createRange();
			if (r.text != "")
				r.text = "[*]" + r.text + "[/*]";
			else
				r.text = lll;
		} else {												// Neither.
			TextArea.value += lll + " ";
		}
		TextArea.focus();
	}
}


$(function (){
	$(".formatToolbar .primary .btn[tag]").click(function (){
		var tag = $(this).attr("tag");
		if (tag){
			InsertText(tag, true);
		}
	});
	
	$(".formatToolbar .primary .bullet").click(function (){
		InsertList();
	});
	
	$(".formatToolbar .fontsize").change(function (){
		InsertText($(this).val(), true);
		$(this).val(",,");
	});
	
	$(".formatToolbar .fontcolor").change(function (){
		InsertText($(this).val(), true);
		$(this).val(",,");
	});
	
	$(".icons .icon").click(function (){
		InsertText($(this).attr("code"), false);
	});
});