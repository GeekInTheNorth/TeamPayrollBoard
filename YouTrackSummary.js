$(document).ready(function () {
    StartUpdate();
});

function StartUpdate() {
    RemoveContent();

    $.ajax({
        type: "Get",
        url: "./Data/Configuration.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            UpdateYouTrackData(jsonData);
        },
        error: function () {
            DisplayConnectionError();
        }        
    });

    var refreshRate = parseInt($('body').attr('data-refresh-rate'));
    window.setTimeout(function () { StartUpdate(); }, refreshRate);
}

function UpdateYouTrackData(jsonData) {
    var states = [];
    var screenConfig;
    var screenIndex = parseInt($('body').attr("data-current-screen-index"));
    
    for (var key in jsonData) {
        if (key == "Screens") {
            var numberOfScreens = Object.keys(jsonData[key]).length;
            screenIndex += 1;
            if (screenIndex >= numberOfScreens)
                screenIndex = 0;
            $('body').attr("data-current-screen-index", screenIndex);

            var screenConfigs = jsonData[key];
            screenConfig = screenConfigs[screenIndex.toString()];
        } else if (key == "States") {
            var stateInformations = jsonData[key];

            for (var stateInformation in stateInformations) {
                var displayName = "";
                var actualName = "";
                for (var stateInformationKey in stateInformations[stateInformation]) {
                    if (stateInformationKey == "Name")
                        actualName = stateInformations[stateInformation][stateInformationKey];
                    if (stateInformationKey == "DisplayName")
                        displayName = stateInformations[stateInformation][stateInformationKey];
                }
                states[actualName] = displayName;
            }
        } else if (key == "RefreshRate") {
            var newRefreshRate = parseInt(jsonData[key]);
            $('body').attr('data-refresh-rate', newRefreshRate);
        }
    }

    if (screenConfig != null) {
        var dataType = "";
        var dataUrl = "";
        var numberOfItems = 0;
        
        for (var screenKey in screenConfig) {
            if (screenKey == "DisplayName") {
                var pageTitle = screenConfig[screenKey];
                var screenWidth = $(window).width();
                $("body").append('<div class="page-title" id="container-page-title" style="width: ' + (screenWidth - 23) + 'px;">' + pageTitle + '</div>');
            } else if (screenKey == "DataType") {
                dataType = screenConfig[screenKey];
            } else if (screenKey == "Url") {
                dataUrl = screenConfig[screenKey];
            } else if (screenKey == "NumberOfItems") {
                numberOfItems = parseInt(screenConfig[screenKey]);
            }
        }
        
        if (dataType == "ItemList") {
            GetLatestUpdatedItems(dataUrl);
        } else if (dataType == "StateCounts") {
            CountYouTrackItemsOnBoard(dataUrl, states);
        } else if (dataType == "Events") {
            GetEvents(dataUrl, numberOfItems);
        } else if (dataType == "Messages") {
            GetMessages(dataUrl);
        }
    }
}

function GetLatestUpdatedItems(youTrackUrl) {
    $.ajax({
        url: youTrackUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            DisplayLatestUpdatedItems(jsonData);
        },
        error: function () {
            DisplayConnectionError();
        }
    });
}

function DisplayLatestUpdatedItems(jsonData) {
    var markUp = '<div class="issue-list" id="YouTrackItemList"><table class="issue-list">';
    
    for (var key in jsonData) {
        var youTrackId = "";
        var youTrackTitle = "";
        var youTrackUser = "";
        var youTrackType = "";
        var youTrackState = "";
        var updated = "";
        var boardType = "";

        var youTrackItem = jsonData[key];
        for (var youTrackItemField in youTrackItem) {
            if (youTrackItemField == "id")
                youTrackId = youTrackItem[youTrackItemField];
            else if (youTrackItemField == "field") {
                // This contains an array of objects which are in turn an array of objects ... yuk
                var customFields = youTrackItem[youTrackItemField];
                for (var customField in customFields) {
                    var field = customFields[customField];

                    if (field["name"] == "summary")
                        youTrackTitle = field["value"];
                    else if (field["name"] == "updated")
                        updated = ConvertYouTrackDate(field["value"]);
                    else if (field["name"] == "updaterFullName")
                        youTrackUser = field["value"];
                    else if (field["name"] == "Type")
                        youTrackType = field["value"].toString();
                    else if (field["name"] == "State")
                        youTrackState = field["value"].toString();
                    else {
                        console.log(field["name"].toString() + " = " + field["value"].toString());
                    }
                }
            }
        }
        
        markUp = markUp + DisplayYouTrackItem(boardType, youTrackId, youTrackTitle, youTrackUser, youTrackType, updated, youTrackState);
    }

    markUp = markUp + '</table></div>';
    $("body").append(markUp);
}

function CountYouTrackItemsOnBoard(youTrackUrl, states) {
    $.ajax({
        url: youTrackUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function(jsonData) {
            CountIssues(jsonData, states);
        },
        error: function () {
            DisplayConnectionError();
        }
    });
}

function CountIssues(jsonData, states) {
    var counts = [];
    for (var stateName in states)
        counts[stateName] = 0;
    counts["PayrollBoardTotal"] = 0;
    
    for (var key in jsonData) {
        var youTrackType = "";
        var youTrackState = "";

        var youTrackItem = jsonData[key];
        for (var youTrackItemField in youTrackItem) {
            if (youTrackItemField == "field") {
                // This contains an array of objects which are in turn an array of objects ... yuk
                var customFields = youTrackItem[youTrackItemField];
                for (var customField in customFields) {
                    var field = customFields[customField];

                    if (field["name"] == "Type")
                        youTrackType = field["value"].toString();
                    else if (field["name"] == "State") 
                        youTrackState = field["value"].toString();
                }
            }
        }
        if ((youTrackType != "Feature") && (youTrackType != "Task")) {
            counts["PayrollBoardTotal"]++;
            counts[youTrackState]++;
        }
    }
    DisplayCounts(counts, states);
}

function DisplayCounts(counts, states) {
    var screenWidth = $(window).width();
    var stateTotal = screenWidth;
    if (stateTotal > 750)
        stateTotal = Math.floor(stateTotal / 2);
    stateTotal = stateTotal - 9;
    
    $("body").append('<div class="board" id="YouTrackItemCount"></div>');

    var boardCounts = $("#YouTrackItemCount");
    
    for (var stateName in states)
        boardCounts.append('<div class="board-state" style="width: ' + stateTotal + 'px;"><table class="board-count"><tr><td class="board-count-title">' + states[stateName] + '</td><td class="board-count-number">' + counts[stateName] + '</td></tr></table></div>');

    boardCounts.append('<div class="clear"></div>');
    boardCounts.append('<div class="page-title" style="width: ' + (screenWidth - 23) + 'px;">Total : ' + counts["PayrollBoardTotal"] + '</div>');
}

function DisplayYouTrackItem(boardType, youTrackId, youTrackTitle, youTrackUser, youTrackType, updated, youTrackState) {
    var formattedId = youTrackId.replace("-", "&#8209;");

    var markUp = '<tr class="youtrack-first-row"><td rowspan="3" class="youtrack-id">' + formattedId + '</td><td class="youtrack-body">' + youTrackType + ' : ' + youTrackTitle + '</td></tr>'
               + '<tr class="youtrack-middle-row"><td class="youtrack-body">State : ' + youTrackState + '</td></tr>'
               + '<tr class="youtrack-last-row"><td class="youtrack-body">Updated : ' + youTrackUser + ' at ' + updated + '</td></tr>';
    
    return markUp;
}

function DisplayConnectionError() {
    RemoveContent();
    var screenWidth = $(window).width();
    $("body").append('<div class="error-panel" id="connection-error-message" style="width: ' + (screenWidth - 23) + 'px;">Oh dear, I could not connect to the datasource!</div>');
}

function ConvertYouTrackDate(milliseconds) {
    var thisDate = new Date(0);
    thisDate.setMilliseconds(milliseconds);

    // YouTrack stores seconds, we need to convert this from a UTC datetime to a local datetime
    // Previously we handled this by adding an hour which worked for our own location
    var dateString = thisDate.toString();
    if (dateString.indexOf("GMT") >= 0) {
        dateString = dateString.substring(0, dateString.indexOf("GMT"));
        dateString.trim();
        dateString += "UTC";

        thisDate = new Date(dateString);
    }
    
    var displayString = "";

    if (thisDate.getDate() < 10)
        displayString = "0" + thisDate.getDate() + "/";
    else
        displayString = thisDate.getDate() + "/";
    
    if ((thisDate.getMonth() + 1) < 10)
        displayString = displayString + "0" + (thisDate.getMonth() + 1) + "/" + thisDate.getFullYear() + " at ";
    else
        displayString = displayString + (thisDate.getMonth() + 1) + "/" + thisDate.getFullYear() + " at ";

    if (thisDate.getHours() < 10)
        displayString = displayString + "0" + thisDate.getHours() + ":";
    else
        displayString = displayString + thisDate.getHours() + ":";
    
    if (thisDate.getMinutes() < 10)
        displayString = displayString + "0" + thisDate.getMinutes();
    else
        displayString = displayString + thisDate.getMinutes();

    return displayString;
}

function GetEvents(dataUrl, numberOfItems) {
    $.ajax({
        type: "Get",
        url: dataUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            DrawEvents(jsonData, numberOfItems);
        },
        error: function () {
            DisplayConnectionError();
        }
    });
}

function DrawEvents(jsonData, numberOfItems) {
    var markUp = '<div class="event-list" id="EventList"><table class="event-list">';
    var eventDatesDrawn = 0;
    var allEventsData = jsonData["Events"];
    
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayString = $.format.date(today, "dd/MM/yyyy");

    var tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000));
    var tomorrowString = $.format.date(tomorrow, "dd/MM/yyyy");
    

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
                markUp += '<tr><td class="event-date">' + dateString + '</td><td class="event-detail">' + eventDescription + '</td></tr>';
            
            eventDatesDrawn++;
        }
    }

    markUp = markUp + '</table></div>';
    $("body").append(markUp);
}

function GetMessages(dataUrl) {
    $.ajax({
        type: "Get",
        url: dataUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            DrawMessages(jsonData);
        },
        error: function () {
            DisplayConnectionError();
        }
    });
}

function DrawMessages(jsonData) {
    var markUp = '<div class="message-list" id="EventList"><table class="event-list">';
    var allMessagesData = jsonData["Messages"];

    for (var key in allMessagesData) {
        var eventData = allMessagesData[key];
        var messageText = eventData["Message"];
        markUp += '<tr><td class="message-detail">' + messageText + '</td></tr>';
    }

    markUp = markUp + '</table></div>';
    $("body").append(markUp);
}

function RemoveContent() {
    $("#container-page-title").remove();
    $("#YouTrackItemList").remove();
    $("#YouTrackItemCount").remove();
    $("#EventList").remove();
    $("#message-list").remove();
    $("#connection-error-message").remove();
}

function parseDate(input) {
    var parts = input.split('-');
    // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
    return new Date(parts[0], parts[1] - 1, parts[2]); // Note: months are 0-based
}