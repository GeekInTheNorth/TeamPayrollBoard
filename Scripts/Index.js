$(document).ready(function () {
    $("li").click(function () {
        window.location = $(this).find("a").first().attr("href");

        return false;
    });
});