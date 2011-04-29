$(function (){
	$("#postPage .pagination  .body .jumpLink select").change(function (){
		location.href = $(this).attr("href") + $(this).val();
	});
});