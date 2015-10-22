$(document).ready(function () {
    StartUpdate();
});

function StartUpdate() {
    $.ajax({
        type: "Get",
        url: "./Data/DefectLogParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            var settings = GetSettings(jsonData)
            SetRefresh(settings.NextScreenUrl, settings.ScreenDuration);
            GetYouTrackData(settings);
        }
    });
}

function GetSettings(jsonData)
{
    var settings = new Object();
    settings.ScreenDuration = 0;
    settings.NextScreenUrl = undefined;
    settings.YouTrackQueryUrl = undefined;
    settings.ReworkTypes = [];
    settings.DefectTypes = [];

    for (var key in jsonData)
    {
        if (key === "ScreenDuration") {
            settings.ScreenDuration = parseInt(jsonData[key]);
        } else if (key === "NextScreenUrl") {
            settings.NextScreenUrl = jsonData[key];
        } else if (key === "YouTrackQueryUrl") {
            settings.YouTrackQueryUrl = jsonData[key];
        } else if (key === "ReworkTypes") {
            var reworkCollection = jsonData[key];
            for (var reworkIndex in reworkCollection) {
                var reworkTaskType = reworkCollection[reworkIndex];
                settings.ReworkTypes.push(reworkTaskType);
            }
        } else if (key === "DefectTypes") {
            var defectCollection = jsonData[key];
            for (var defectIndex in defectCollection) {
                var defectTaskType = defectCollection[defectIndex];
                settings.DefectTypes.push(defectTaskType);
            }
        }
    }

    return settings;
}

function GetYouTrackData(settings) {
    $.ajax({
        url: settings.YouTrackQueryUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            ParseYouTrackData(settings, jsonData);
        }
    });
}

function ParseYouTrackData(settings, jsonData) {
    var items = [];

    for (var taskLocation in jsonData) {
        var task = jsonData[taskLocation];
        var createdDate = undefined;
        var sprintName = undefined;
        var resolved = undefined;
        var state = undefined;
        var type = undefined;

        for (var fieldLocation in task.field) {
            var field = task.field[fieldLocation];

            if (field.name == "Type") {
                type = field.value[0];
            }

            if (field.name == "created") {
                createdDate = ConvertYouTrackDate(field.value);
            }

            if (field.name == "Sprint") {
                sprintName = field.value[0];
            }

            if (field.name == "State") {
                state = field.value[0];
            }

            if (field.name == "resolved") {
                resolved = ConvertYouTrackDate(field.value);
            }
        }

        var taskObject = new Object();
        taskObject.Type = type;
        taskObject.Created = createdDate;
        taskObject.Sprint = sprintName;
        taskObject.State = state;
        taskObject.Resolved = resolved;

        items.push(taskObject);
    }

    AnalyzeReworksBySprint(settings, items);
    AnalyzeIssuesByMonth(settings, items);
}

function AnalyzeReworksBySprint(settings, tasks) {
    var reworksBySprints = [];

    for (var taskLocation in tasks)
    {
        var task = tasks[taskLocation];

        if ($.inArray(task.Type, settings.ReworkTypes) === -1)
            continue;

        if (task.Sprint === undefined)
            continue

        var foundReworksBySprint = false;

        for (var reworksBySprintLocation in reworksBySprints)
        {
            var reworksBySprint = reworksBySprints[reworksBySprintLocation];

            if (reworksBySprint.Sprint == task.Sprint)
            {
                foundReworksBySprint = true;
                reworksBySprint.Items = 1 + reworksBySprint.Items;
            }
        }

        if (!foundReworksBySprint)
        {
            var newReworkBySprint = new Object();
            newReworkBySprint.Sprint = task.Sprint;
            newReworkBySprint.Items = 1;
            reworksBySprints.push(newReworkBySprint);
        }
    }

    if (reworksBySprints.length === 0) return;

    var markUp = "";
    var rowClass = "";
    var totalItems = 0;
    $("body").append("<h1>Rework Items By Sprint</h1>");
    $("body").append("<table id='table-rework-by-sprint'><tr><th class='text-cell'>Sprint</th><th class='numeric-cell'>Rework Items</th></tr></table>");
    for (var reworkSummaryLocation in reworksBySprints)
    {
        var reworkSummary = reworksBySprints[reworkSummaryLocation];
        totalItems += reworkSummary.Items;

        if (rowClass === "normal-row")
            rowClass = "alternate-row";
        else
            rowClass = "normal-row";

        var markUp = "<tr class='" + rowClass + "'>";
        markUp += "<td class='text-cell'>" + reworkSummary.Sprint + "</td>";
        markUp += "<td class='numeric-cell'>" + reworkSummary.Items + "</td>";
        markUp += "</tr>";
        $("#table-rework-by-sprint tr:last").after(markUp);
    }

    if (rowClass === "normal-row")
        rowClass = "alternate-row";
    else
        rowClass = "normal-row";

    var markUp = "<tr class='" + rowClass + "'>";
    markUp += "<th class='text-cell'>Total</th>";
    markUp += "<th class='numeric-cell'>" + totalItems + "</th>";
    markUp += "</tr>";
    $("#table-rework-by-sprint tr:last").after(markUp);
}

function AnalyzeIssuesByMonth(settings, tasks) {
    var monthData = GetMonthCollection();

    for (var taskLocation in tasks) {
        var task = tasks[taskLocation];
        var createdDate = task.Created.substr(6, 4) + "-" + task.Created.substr(3, 2) + "-" + task.Created.substr(0, 2);
        var createdDescription = GetMonthString(new Date(createdDate));

        var resolvedDescription = "n/a";
        var resolvedDate = "n/a";
        if (task.Resolved != undefined) {
            resolvedDate = task.Resolved.substr(6, 4) + "-" + task.Resolved.substr(3, 2) + "-" + task.Resolved.substr(0, 2);
            resolvedDescription = GetMonthString(new Date(resolvedDate));
        }

        for (var monthDataLocation in monthData) {
            if (createdDescription === monthData[monthDataLocation].Description) {
                if ($.inArray(task.Type, settings.ReworkTypes) > -1)
                    monthData[monthDataLocation].ReworkItems += 1;
                if ($.inArray(task.Type, settings.DefectTypes) > -1)
                    monthData[monthDataLocation].DefectsLogged += 1;
            }
            if (resolvedDescription === monthData[monthDataLocation].Description) {
                if ($.inArray(task.Type, settings.DefectTypes) > -1)
                    monthData[monthDataLocation].DefectsFixed += 1;
            }
        }
    }

    $("body").append("<h1>Rework & Defects By Month</h1>");
    $("body").append("<table id='table-rework-by-month'><tr><th class='text-cell'>Period</th><th class='numeric-cell'>Rework Items</th><th class='numeric-cell'>Defects Logged</th><th class='numeric-cell'>Defects Closed</th><th class='numeric-cell'>Net Defect Change</th></tr></table>");

    var rowClass = "";
    var totalReworkItems = 0;
    var totalDefectsLogged = 0;
    var totalDefectsFixed = 0;
    var markUp = "";
    for (var monthDataLocation in monthData) {
        var monthSummary = monthData[monthDataLocation];
        totalReworkItems += monthSummary.ReworkItems;
        totalDefectsLogged += monthSummary.DefectsLogged;
        totalDefectsFixed += monthSummary.DefectsFixed;
        
        if (rowClass === "normal-row")
            rowClass = "alternate-row";
        else
            rowClass = "normal-row";

        var markUp = "<tr class='" + rowClass + "'>";
        markUp += "<td class='text-cell'>" + monthSummary.Description + "</td>";
        markUp += "<td class='numeric-cell'>" + monthSummary.ReworkItems + "</td>";
        markUp += "<td class='numeric-cell'>" + monthSummary.DefectsLogged + "</td>";
        markUp += "<td class='numeric-cell'>" + monthSummary.DefectsFixed + "</td>";
        markUp += "<td class='numeric-cell'>" + (monthSummary.DefectsLogged - monthSummary.DefectsFixed) + "</td>";
        markUp += "</tr>";
        $("#table-rework-by-month tr:last").after(markUp);
    }

    if (rowClass === "normal-row")
        rowClass = "alternate-row";
    else
        rowClass = "normal-row";

    var markUp = "<tr class='" + rowClass + "'>";
    markUp += "<th class='text-cell'>Total</th>";
    markUp += "<th class='numeric-cell'>" + totalReworkItems + "</th>";
    markUp += "<th class='numeric-cell'>" + totalDefectsLogged + "</th>";
    markUp += "<th class='numeric-cell'>" + totalDefectsFixed + "</th>";
    markUp += "<th class='numeric-cell'>" + (totalDefectsLogged - totalDefectsFixed) + "</th>";
    markUp += "</tr>";
    $("#table-rework-by-month tr:last").after(markUp);
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
        displayString = displayString + "0" + (thisDate.getMonth() + 1) + "/" + thisDate.getFullYear();
    else
        displayString = displayString + (thisDate.getMonth() + 1) + "/" + thisDate.getFullYear();

    return displayString;
}

function GetMonthCollection() {
    var monthCollection = [];
    var theDate = new Date();
    
    while (theDate >= new Date(2014, 12, 1, 0, 0, 0, 0)) {
        var monthObject = new Object();
        monthObject.Description = GetMonthString(theDate);
        monthObject.ReworkItems = 0;
        monthObject.DefectsLogged = 0;
        monthObject.DefectsFixed = 0;
        monthCollection.push(monthObject);

        var theMonth = theDate.getMonth();
        var theYear = theDate.getFullYear();

        theMonth -= 1;
        if (theMonth < 0) {
            theMonth = 11;
            theYear -= 1;
        }

        theDate = new Date(theYear, theMonth, 1, 0, 0, 0, 0);
    }

    return monthCollection;
}

function GetMonthString(theDate) {
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var theMonth = theDate.getMonth();
    var theYear = theDate.getFullYear();

    return months[theMonth] + " " + theYear;
}

function SetRefresh(refreshUrl, screenDuration) {
    var navigationParameter = getURLParameter("DoNavigation");
    if (navigationParameter != null && navigationParameter === "Yes")
        window.setTimeout(function () { window.location.replace(refreshUrl); }, screenDuration);
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null
}