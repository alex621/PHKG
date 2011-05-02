$(function (){
	$("#topicsList .pagin .fastPagin select").change(function (){
		location.href = $(this).attr("href") + $(this).val();
	});
	
	$("#topicsList .categoryList select").change(function (){
		var v = $(this).val();
		if (v != ""){
			location.href = $(this).attr("href") + v;
		}
	});
});