$(function (){
	$("#topicsList .pagin .fastPagin select").change(function (){
		location.href = $(this).attr("href") + $(this).val();
	});
});