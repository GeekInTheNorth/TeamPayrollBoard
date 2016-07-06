$(document).ready(function () {
    GetEvents();
    setTimeout(function () { window.location.reload(); }, 180000);
});

function GetEvents(dataUrl) {
    var dataUrl = "./Data/Events.json";

    $.ajax({
        type: "Get",
        url: dataUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            DrawEvents(jsonData);
        }
    });
}

function DrawEvents(jsonData) {
    var markUp = '<div class="event-list" id="EventList"><table class="event-list"><tr><th>Due</th><th>Description</th><tr>';
    var eventDatesDrawn = 0;
    var allEventsData = jsonData["Events"];
    var numberOfItems = 10;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayString = $.format.date(today, "dd/MM/yyyy");

    var lastWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    var tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000));
    var tomorrowString = $.format.date(tomorrow, "dd/MM/yyyy");
    var yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
    var yesterdayString = $.format.date(yesterday, "dd/MM/yyyy");

    for (var key in allEventsData) {
        var eventData = allEventsData[key];
        var eventDate = new Date();
        var eventDescription = "";

        for (var eventDataKey in eventData) {
            if (eventDataKey == "Date") {
                eventDate = parseDate(eventData[eventDataKey]);
            } else if (eventDataKey == "Event") {
                eventDescription = eventData[eventDataKey];
            }
        }

        if (eventDate >= today) {
            var dateString = $.format.date(eventDate, "dd/MM/yyyy");
            if (dateString == todayString)
                dateString = "Today";
            else if (dateString == tomorrowString)
                dateString = "Tomorrow";

            if (eventDatesDrawn < numberOfItems)
                markUp += '<tr><td class="pending">' + dateString + '</td><td class="pending">' + eventDescription + '</td></tr>';

            eventDatesDrawn++;
        }
        else if (eventDate >= lastWeek) {
            var dateString = $.format.date(eventDate, "dd/MM/yyyy");
            if (dateString == yesterdayString)
                dateString = "Yesterday";

            if (eventDatesDrawn < numberOfItems)
                markUp += '<tr><td class="history">' + dateString + '</td><td class="history">' + eventDescription + '</td></tr>';

            eventDatesDrawn++;
        }

        if (eventDatesDrawn >= numberOfItems)
            break;
    }

    markUp = markUp + '</table></div>';
    $("body").append(markUp);
    ShowRowColoursForBreakdowns();
}

function parseDate(input) {
    var parts = input.split('-');
    // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
    return new Date(parts[0], parts[1] - 1, parts[2]); // Note: months are 0-based
}

function ShowRowColoursForBreakdowns() {
    $("table.event-list tr:even").addClass("alternate-row");
    $("table.event-list tr:odd").addClass("normal-row");
}