$(document).ready(function () {
    $("div.menu-item").click(function () {
        window.location = $(this).find("a").first().attr("href");

        return false;
    });
});