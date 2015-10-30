var youTrackIssues = [];
var issuedLogged = [];
var apisCompleted = 0;
var settings = undefined;

$(document).ready(function () {
    ShowDefectSummary();
});

function ShowDefectSummary() {
    $("body").empty();

    $.ajax({
        type: "Get",
        url: "./Data/DefectLogParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            LoadSettings(jsonData)
            SetRefresh();
            GetYouTrackData(settings);
        }
    });
}

function LoadSettings(jsonData)
{
    settings = new Object();
    settings.ScreenDuration = 0;
    settings.NextScreenUrl = undefined;
    settings.YouTrackApiUrl = undefined;
    settings.YouTrackIssueUrl = undefined;
    settings.ReworkTypes = [];
    settings.DefectTypes = [];
    settings.Projects = [];

    for (var key in jsonData)
    {
        if (key === "ScreenDuration") {
            settings.ScreenDuration = parseInt(jsonData[key]);
        } else if (key === "NextScreenUrl") {
            settings.NextScreenUrl = jsonData[key];
        } else if (key === "YouTrackApiUrl") {
            settings.YouTrackApiUrl = jsonData[key];
        } else if (key === "YouTrackIssueUrl") {
            settings.YouTrackIssueUrl = jsonData[key];
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
        } else if (key === "Projects") {
            var projectCollection = jsonData[key];
            for (var projectIndex in projectCollection) {
                var projectName = projectCollection[projectIndex];
                settings.Projects.push(projectName);
            }
        }
    }
}

function GetYouTrackData(settings) {
    youTrackIssues = [];
    issuedLogged = [];
    apisCompleted = 0;

    var today = new Date();
    var firstMonth = new Date(today.getFullYear() - 1, today.getMonth(), 1, 0, 0, 0, 0);
    var monthCollection = GetMonthCollection();
    var typesFilter = GetTypesFilter(settings);
    var projectsFilter = GetProjectsFilter(settings);
    
    for (var monthLocation in monthCollection) {
        var monthFilter = GetMonthTextQueryString(monthCollection[monthLocation].Description);
        var filterText = projectsFilter + "+" + typesFilter + "+created%3A+" + monthFilter + "+or+" + projectsFilter + "+" + typesFilter + "+resolved%3A+" + monthFilter;
        filterText += "+order+by%3A+created+desc&with=Type&with=created&with=Sprint&with=State&with=resolved&with=summary&with=id&max=500";

        var queryText = settings.YouTrackApiUrl + filterText;

        $.ajax({
            url: queryText,
            dataType: "json",
            headers: {
                accept: 'application/json'
            },
            success: function (jsonData) {
                ConvertYouTrackDataToObjects(jsonData);
                apisCompleted += 1;
            },
            error: function () {
                apisCompleted += 1;
            }
        });
    }

    setTimeout(function () { DisplaySummaryWhenReady() }, 1000);
}

function ConvertYouTrackDataToObjects(jsonData) {
    for (var taskLocation in jsonData.issue) {
        var task = jsonData.issue[taskLocation];
        var createdDate = undefined;
        var sprintName = undefined;
        var resolved = undefined;
        var state = undefined;
        var type = undefined;
        var title = undefined;
        var issueId = task.id;

        if (issuedLogged.indexOf(issueId) > -1) continue;

        issuedLogged.push(issueId);

        for (var fieldLocation in task.field) {
            var field = task.field[fieldLocation];

            if (field.name === "Type") {
                type = field.value[0];
            }

            if (field.name === "created") {
                createdDate = ConvertYouTrackDate(field.value);
            }

            if (field.name === "Sprint") {
                sprintName = field.value[0];
            }

            if (field.name === "State") {
                state = field.value[0];
            }

            if (field.name === "resolved") {
                resolved = ConvertYouTrackDate(field.value);
            }

            if (field.name === "summary") {
                title = field.value;
            }
        }

        var taskObject = new Object();
        taskObject.Type = type;
        taskObject.Created = createdDate;
        taskObject.Sprint = sprintName;
        taskObject.State = state;
        taskObject.Resolved = resolved;
        taskObject.Title = title;
        taskObject.IssueId = issueId;

        youTrackIssues.push(taskObject);
    }

    return youTrackIssues;
}

function DisplaySummaryWhenReady() {
    if (apisCompleted === 13) {
        AnalyzeReworksBySprint();
        AnalyzeIssuesByMonth();
    }
    else
    {
        setTimeout(function () { DisplaySummaryWhenReady(settings) }, 1000);
    }
}

function AnalyzeReworksBySprint() {
    var reworksBySprints = [];

    for (var taskLocation in youTrackIssues)
    {
        var task = youTrackIssues[taskLocation];

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

function AnalyzeIssuesByMonth() {
    var monthData = GetMonthCollection();

    for (var taskLocation in youTrackIssues) {
        var task = youTrackIssues[taskLocation];
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
        markUp += "<td class='text-cell'><a href='#' onclick='DrilldownToMonthBreakdown(\"" + monthSummary.Description + "\");'>" + monthSummary.Description + "</a></td>";
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

function SetRefresh() {
    var navigationParameter = getURLParameter("DoNavigation");
    if (navigationParameter != null && navigationParameter === "Yes")
        window.setTimeout(function () { window.location.replace(settings.NextScreenUrl); }, settings.ScreenDuration);
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null
}

function DrilldownToMonthBreakdown(monthText) {
    var defectRowClass = "";
    var reworkRowClass = "";
    var rowClass = "";
    var defectRowNumber = 0;
    var reworkRowNumber = 0;
    var thisRowNumber = 0;

    $("body").empty();

    var markUp = "<h1>Defects Breakdown for " + monthText + "</h1>";
    markUp += "<table id='table-defect-summary'>";
    markUp += "<th class='text-cell'>#</th>"
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='numeric-cell'>Logged</th>";
    markUp += "<th class='numeric-cell'>Fixed</th>";
    markUp += "</tr></table>";
    markUp += "<h1>Rework Breakdown for " + monthText + "</h1>";
    markUp += "<table id='table-rework-summary'>";
    markUp += "<th class='text-cell'>#</th>"
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='numeric-cell'>Logged</th>";
    markUp += "<th class='numeric-cell'>Fixed</th>";
    markUp += "</tr></table>";

    $("body").append(markUp);

    for (var issueIndex = 0; issueIndex < youTrackIssues.length; issueIndex++) {
        var issue = youTrackIssues[issueIndex];
        var includeItem = (GetStringDateAsMonthText(issue.Created) === monthText) || (GetStringDateAsMonthText(issue.Resolved) === monthText);

        if (!includeItem) continue;

        if (settings.ReworkTypes.indexOf(issue.Type) > -1) {
            if (reworkRowClass === "normal-row")
                reworkRowClass = "alternate-row";
            else
                reworkRowClass = "normal-row";
            rowClass = reworkRowClass;
            reworkRowNumber++;
            thisRowNumber = reworkRowNumber;
        } else {
            if (defectRowClass === "normal-row")
                defectRowClass = "alternate-row";
            else
                defectRowClass = "normal-row";
            rowClass = defectRowClass;
            defectRowNumber++;
            thisRowNumber = defectRowNumber;
        }

        markUp = "<tr class='" + rowClass + "'>";
        markUp += "<td class='numeric-cell'>" + thisRowNumber + "</td>";
        markUp += "<td class='text-cell'><a href='" + settings.YouTrackIssueUrl + issue.IssueId + "' target='_blank'>" + issue.IssueId + "</a></td>";
        markUp += "<td class='text-cell'>" + issue.Type + "</td>";
        markUp += "<td class='text-cell'>" + issue.Title + "</td>";
        markUp += "<td class='numeric-cell'>" + issue.Created + "</td>";

        if (issue.Resolved === undefined)
            markUp += "<td class='numeric-cell'>&nbsp;</td>";
        else
            markUp += "<td class='numeric-cell'>" + issue.Resolved + "</td>";

        markUp += "</tr>";

        if (settings.ReworkTypes.indexOf(issue.Type) > -1)
            $("#table-rework-summary tr:last").after(markUp);
        else
            $("#table-defect-summary tr:last").after(markUp);
    }
}

function GetMonthCollection() {
    var monthCollection = [];
    var theDate = new Date();
    var earliestPeriod = new Date(theDate.getFullYear() - 1, theDate.getMonth(), 1, 0, 0, 0);

    while (theDate >= earliestPeriod) {
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

function GetStringDateAsMonthText(dateString) {
    if (dateString === undefined) return "n/a";

    var yearString = dateString.substr(6, 4);
    var monthString = dateString.substr(3, 2);
    var monthInt = parseInt(monthString);
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return months[monthInt - 1] + " " + yearString;
}

function GetMonthString(theDate) {
    if (theDate === undefined) return "n/a";

    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var theMonth = theDate.getMonth();
    var theYear = theDate.getFullYear();

    return months[theMonth] + " " + theYear;
}

function GetMonthTextQueryString(monthText) {
    var month = monthText.split(' ')[0];
    var year = monthText.split(' ')[1];

    var queryText = "";
    switch (month) {
        case "January":
            queryText = year + "-01";
            break;
        case "February":
            queryText = year + "-02";
            break;
        case "March":
            queryText = year + "-03";
            break;
        case "April":
            queryText = year + "-04";
            break;
        case "May":
            queryText = year + "-05";
            break;
        case "June":
            queryText = year + "-06";
            break;
        case "July":
            queryText = year + "-07";
            break;
        case "August":
            queryText = year + "-08";
            break;
        case "September":
            queryText = year + "-09";
            break;
        case "October":
            queryText = year + "-10";
            break;
        case "November":
            queryText = year + "-11";
            break;
        case "December":
            queryText = year + "-12";
            break;
    }

    return queryText;
}

function GetTypesFilter(settings) {
    var queryText = "Type%3A"
    var doneFirst = false;
    var defectText = "";
    for (var defectLocation in settings.DefectTypes) {
        defectText = settings.DefectTypes[defectLocation];
        defectText = defectText.split(' ').join('+');
        if (doneFirst)
            queryText += "%2C+";
        queryText += "%7B" + defectText + "%7D";

        doneFirst = true;
    }

    for (var reworkLocation in settings.ReworkTypes) {
        defectText = settings.ReworkTypes[reworkLocation];
        defectText = defectText.split(' ').join('+');
        if (doneFirst)
            queryText += "%2C+";
        queryText += "%7B" + defectText + "%7D";

        doneFirst = true;
    }

    return queryText;
}

function GetProjectsFilter(settings) {
    var queryText = "project%3A";
    doneFirst = false;
    for (var projectLocation in settings.Projects) {
        if (doneFirst)
            queryText += "%2C+";
        queryText += settings.Projects[projectLocation];

        doneFirst = true;
    }

    return queryText;
}