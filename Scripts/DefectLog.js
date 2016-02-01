var youTrackIssues = [];
var issuedLogged = [];
var apisCompleted = 0;
var settings = undefined;

$(document).ready(function () {
    ShowDefectSummary();
});

function ShowDefectSummary() {
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
    settings.YouTrackRootUrl = undefined;
    settings.ReworkTypes = [];
    settings.DefectTypes = [];
    settings.Projects = [];
    settings.UserStoryTypes = [];
    settings.Exclusions = [];


    for (var key in jsonData)
    {
        if (key === "ScreenDuration") {
            settings.ScreenDuration = parseInt(jsonData[key]);
        } else if (key === "NextScreenUrl") {
            settings.NextScreenUrl = jsonData[key];
        } else if (key === "YouTrackRootUrl") {
            settings.YouTrackRootUrl = jsonData[key];
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
        } else if (key === "UserStoryTypes") {
            var userStoryTypeCollection = jsonData[key];
            for (var userStoryIndex in userStoryTypeCollection) {
                var userStoryType = userStoryTypeCollection[userStoryIndex];
                settings.UserStoryTypes.push(userStoryType);
            }
        } else if (key === "Exclusions") {
            var exclusionCollection = jsonData[key];
            for (var exclusionIndex in exclusionCollection) {
                var exclusionFieldCollection = exclusionCollection[exclusionIndex];
                var exclusion = new Object();
                exclusion.Field = undefined;
                exclusion.Value = undefined;
                for (var exclusionFieldKey in exclusionFieldCollection) {
                    if (exclusionFieldKey === "Field")
                        exclusion.Field = exclusionFieldCollection[exclusionFieldKey];
                    if (exclusionFieldKey === "Value")
                        exclusion.Value = exclusionFieldCollection[exclusionFieldKey];
                }

                settings.Exclusions.push(exclusion);
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
    
    for (var monthLocation in monthCollection) {
        var monthFilter = GetMonthTextQueryString(monthCollection[monthLocation].Description);
        var filterText = "created%3A+" + monthFilter + "+or+resolved%3A+" + monthFilter;
        filterText += "+order+by%3A+created+desc&with=Type&with=Project&with=created&with=Sprint&with=State&with=resolved&with=summary&with=id&with=subsystem&with=priority&max=500";

        var queryText = settings.YouTrackRootUrl + "/rest/issue?filter=" + filterText;

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
        var subSystem = undefined;
        var issueId = task.id;
        var validId = false;
        var priority = "unknown";

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

            if (field.name === "Priority") {
                priority = field.value[0];
            }

            if (field.name === "Subsystem") {
                subSystem = field.value[0];
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
        taskObject.Subsystem = subSystem;
        taskObject.IsExcluded = false;
        taskObject.Priority = priority;

        for (var projectIndex in settings.Projects)
        {
            var projectName = settings.Projects[projectIndex];
            if (taskObject.IssueId.indexOf(projectName) > -1) {
                validId = true
            }
        }

        if (!validId)
            continue;

        if ((settings.UserStoryTypes.indexOf(taskObject.Type) === -1) &&
            (settings.ReworkTypes.indexOf(taskObject.Type) === -1) &&
            (settings.DefectTypes.indexOf(taskObject.Type) === -1))
            continue;

        for (var exclusionIndex in settings.Exclusions) {
            var exclusion = settings.Exclusions[exclusionIndex];

            if ((exclusion.Field === "Sprint") && (exclusion.Value === taskObject.Sprint))
                taskObject.IsExcluded = true;
            if ((exclusion.Field === "Type") && (exclusion.Value === taskObject.Type))
                taskObject.IsExcluded = true;
            if ((exclusion.Field === "Subsystem") && (exclusion.Value === taskObject.Subsystem))
                taskObject.IsExcluded = true;
        }

        if (taskObject.IsExcluded === false)
            youTrackIssues.push(taskObject);
    }

    return youTrackIssues;
}

function DisplaySummaryWhenReady() {
    if (apisCompleted === 13) {
        $("body").empty();
        SetHeader();
        youTrackIssues.sort(SortByDate);
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

    reworksBySprints = reworksBySprints.sort(CompareSprint);

    var markUp = "";
    var rowClass = "";
    var totalItems = 0;
    $("body").append("<h1>Rework Items By Sprint</h1>");
    $("body").append("<table id='table-rework-by-sprint' class='datatable'><tr><th class='text-cell'>Sprint</th><th class='numeric-cell'>Rework Items</th></tr></table>");
    for (var reworkSummaryLocation in reworksBySprints)
    {
        var reworkSummary = reworksBySprints[reworkSummaryLocation];
        totalItems += reworkSummary.Items;

        if (rowClass === "normal-row")
            rowClass = "alternate-row";
        else
            rowClass = "normal-row";

        var markUp = "<tr class='" + rowClass + "'>";
        markUp += "<td class='text-cell'><a href='#' onclick='javascript:DrilldownToSprintBreakdown(\"" + reworkSummary.Sprint + "\");'>" + reworkSummary.Sprint + "</a></td>";
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
                if ($.inArray(task.Type, settings.UserStoryTypes) > -1)
                    monthData[monthDataLocation].UserStoriesCompleted += 1;
            }
        }
    }

    $("body").append("<h1>Rework & Defects By Month</h1>");
    $("body").append("<table id='table-rework-by-month' class='datatable'><tr><th class='text-cell'>Period</th><th class='numeric-cell'>User Stories Completed</th><th class='numeric-cell'>Rework Items</th><th class='numeric-cell'>Defects Logged</th><th class='numeric-cell'>Defects Closed</th><th class='numeric-cell'>Net Defect Change</th></tr></table>");

    var rowClass = "";
    var totalReworkItems = 0;
    var totalDefectsLogged = 0;
    var totalDefectsFixed = 0;
    var totalUserStoriesCompleted = 0;
    var markUp = "";
    for (var monthDataLocation in monthData) {
        var monthSummary = monthData[monthDataLocation];
        totalReworkItems += monthSummary.ReworkItems;
        totalDefectsLogged += monthSummary.DefectsLogged;
        totalDefectsFixed += monthSummary.DefectsFixed;
        totalUserStoriesCompleted += monthSummary.UserStoriesCompleted;
        
        if (rowClass === "normal-row")
            rowClass = "alternate-row";
        else
            rowClass = "normal-row";

        var markUp = "<tr class='" + rowClass + "'>";
        markUp += "<td class='text-cell'><a href='#' onclick='DrilldownToMonthBreakdown(\"" + monthSummary.Description + "\");'>" + monthSummary.Description + "</a></td>";
        markUp += "<td class='numeric-cell'>" + monthSummary.UserStoriesCompleted + "</td>";
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
    markUp += "<th class='numeric-cell'>" + totalUserStoriesCompleted + "</th>";
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
    var userStoryRowNumber = 0;
    var defectRowNumber = 0;
    var reworkRowNumber = 0;
    var thisRowNumber = 0;

    var previousMonthText = GetPreviousMonthText(monthText);

    $("body").empty();
    SetHeader();
    CreateBreakDownTitles(monthText, previousMonthText);

    for (var issueIndex = 0; issueIndex < youTrackIssues.length; issueIndex++) {
        var issue = youTrackIssues[issueIndex];

        var includeItem = false;

        if ((settings.UserStoryTypes.indexOf(issue.Type) > -1) && ((GetStringDateAsMonthText(issue.Resolved) === monthText) || (GetStringDateAsMonthText(issue.Resolved) === previousMonthText))) {
            includeItem = true
        }

        if (((settings.ReworkTypes.indexOf(issue.Type) > -1) || (settings.DefectTypes.indexOf(issue.Type) > -1)) &&
            ((GetStringDateAsMonthText(issue.Created) === monthText) || (GetStringDateAsMonthText(issue.Resolved) === monthText))) {
            includeItem = true
        }
            

        if (!includeItem) continue;

        if (settings.UserStoryTypes.indexOf(issue.Type) > -1)
        {
            if (issue.Resolved === undefined) continue;

            userStoryRowNumber++;
            thisRowNumber = userStoryRowNumber;
        } else if (settings.ReworkTypes.indexOf(issue.Type) > -1) {
            reworkRowNumber++;
            thisRowNumber = reworkRowNumber;
        } else {
            defectRowNumber++;
            thisRowNumber = defectRowNumber;
        }

        DrawBreakdownRowMarkup(thisRowNumber, issue.IssueId, issue.Type, issue.Subsystem, issue.Title, issue.Created, issue.Resolved, issue.Priority, previousMonthText);
    }

    ShowRowColoursForBreakdowns();
    HideEmptyBreakdowns();
}

function DrilldownToSprintBreakdown(sprintText) {
    var userStoryRowNumber = 0;
    var defectRowNumber = 0;
    var reworkRowNumber = 0;
    var thisRowNumber = 0;

    $("body").empty();
    SetHeader();
    CreateBreakDownTitles(sprintText, undefined);

    for (var issueIndex = 0; issueIndex < youTrackIssues.length; issueIndex++) {
        var issue = youTrackIssues[issueIndex];

        if (issue.Sprint != sprintText) continue;

        if (settings.UserStoryTypes.indexOf(issue.Type) > -1) {
            if (issue.Resolved === undefined) continue;

            userStoryRowNumber++;
            thisRowNumber = userStoryRowNumber;
        } else if (settings.ReworkTypes.indexOf(issue.Type) > -1) {
            reworkRowNumber++;
            thisRowNumber = reworkRowNumber;
        } else {
            defectRowNumber++;
            thisRowNumber = defectRowNumber;
        }

        DrawBreakdownRowMarkup(thisRowNumber, issue.IssueId, issue.Type, issue.Subsystem, issue.Title, issue.Created, issue.Resolved, issue.Priority, undefined);
    }

    ShowRowColoursForBreakdowns();
    HideEmptyBreakdowns();
}

function DrawBreakdownRowMarkup(rowNumber, issueId, issueType, issueSubsystem, issueTitle, issueCreated, issueResolved, issuePriority, previousMonthText) {
    var markUp = "<tr>";
    markUp += "<td class='numeric-cell'>" + rowNumber + "</td>";
    markUp += "<td class='text-cell'><a href='" + settings.YouTrackRootUrl + "/issue/" + issueId + "' target='_blank'>" + issueId + "</a></td>";
    markUp += "<td class='text-cell'>" + issueType + "</td>";
    markUp += "<td class='text-cell'>" + issueTitle + "</td>";
    markUp += "<td class='text-cell'>" + issueSubsystem + "</td>";
    markUp += "<td class='numeric-cell'>" + issueCreated + "</td>";
    
    if (issueResolved === undefined)
        markUp += "<td class='numeric-cell'>&nbsp;</td>";
    else
        markUp += "<td class='numeric-cell'>" + issueResolved + "</td>";

    markUp += "<td class='text-cell'>" + issuePriority + "</td>";
    markUp += "</tr>";

    if (settings.UserStoryTypes.indexOf(issueType) > -1) {
        if ((previousMonthText != undefined) && (GetStringDateAsMonthText(issueResolved) === previousMonthText))
            $("#table-user-story-completed-previously tr:last").after(markUp);
        else
            $("#table-user-story-completed tr:last").after(markUp);
    }        
    else if (settings.ReworkTypes.indexOf(issueType) > -1)
        $("#table-rework-summary tr:last").after(markUp);
    else
        $("#table-defect-summary tr:last").after(markUp);
}

function HideEmptyBreakdowns() {
    if ($('#table-user-story-completed tr').length === 1) {
        $("#header-user-story-completed").remove();
        $("#table-user-story-completed").remove();
    }

    if ($('#table-user-story-completed-previously tr').length === 1) {
        $("#header-user-story-completed-previously").remove();
        $("#table-user-story-completed-previously").remove();
    }    

    if ($('#table-defect-summary tr').length === 1) {
        $("#header-defect-summary").remove();
        $("#table-defect-summary").remove();
    }

    if ($('#table-rework-summary tr').length === 1) {
        $("#header-rework-summary").remove();
        $("#table-rework-summary").remove();
    }
}

function CreateBreakDownTitles(periodText, previousPeriodText) {
    var markUp = "<h1 id='header-user-story-completed'>User Stories Completed In " + periodText + "</h1>";
    markUp += "<table id='table-user-story-completed' class='datatable'>";
    markUp += "<th class='text-cell'>#</th>"
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Module</th>";
    markUp += "<th class='numeric-cell'>Logged</th>";
    markUp += "<th class='numeric-cell'>Completed</th>";
    markUp += "<th class='text-cell'>Priority</th>";
    markUp += "</tr></table>";

    if ((previousPeriodText != undefined) && (previousPeriodText.length > 0)) {
        markUp += "<h1 id='header-user-story-completed-previously'>User Stories Completed In " + previousPeriodText + "</h1>";
        markUp += "<table id='table-user-story-completed-previously' class='datatable'>";
        markUp += "<th class='text-cell'>#</th>"
        markUp += "<th class='text-cell'>Issue Id</th>";
        markUp += "<th class='text-cell'>Type</th>";
        markUp += "<th class='text-cell'>Title</th>";
        markUp += "<th class='text-cell'>Module</th>";
        markUp += "<th class='numeric-cell'>Logged</th>";
        markUp += "<th class='numeric-cell'>Completed</th>";
        markUp += "<th class='text-cell'>Priority</th>";
        markUp += "</tr></table>";
    }

    markUp += "<h1 id='header-defect-summary'>Defects Breakdown for " + periodText + "</h1>";
    markUp += "<table id='table-defect-summary' class='datatable'>";
    markUp += "<th class='text-cell'>#</th>"
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Module</th>";
    markUp += "<th class='numeric-cell'>Logged</th>";
    markUp += "<th class='numeric-cell'>Fixed</th>";
    markUp += "<th class='text-cell'>Severity</th>";
    markUp += "</tr></table>";
    markUp += "<h1 id='header-rework-summary'>Rework Breakdown for " + periodText + "</h1>";
    markUp += "<table id='table-rework-summary' class='datatable'>";
    markUp += "<th class='text-cell'>#</th>"
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Module</th>";
    markUp += "<th class='numeric-cell'>Logged</th>";
    markUp += "<th class='numeric-cell'>Fixed</th>";
    markUp += "<th class='text-cell'>Severity</th>";
    markUp += "</tr></table>";

    $("body").append(markUp);
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
        monthObject.UserStoriesCompleted = 0;
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

function GetPreviousMonthText(thisMonthText) {
    var theDate = new Date((GetMonthTextQueryString(thisMonthText) + "-01"));
    if (theDate.getMonth() == 0) {
        theDate = new Date(theDate.getFullYear() - 1, 11, 1, 0, 0, 0, 0);
    } else {
        theDate = new Date(theDate.getFullYear(), theDate.getMonth() - 1, 1, 0, 0, 0, 0);
    }

    return GetMonthString(theDate);
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

    for (var userStoryLocation in settings.UserStoryTypes) {
        defectText = settings.UserStoryTypes[userStoryLocation];
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

function SetHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a href='#' onclick='javascript:ShowSummary();' class='Header-Command'>Summary</a>";
    markUp += "<a href='#' onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function ShowSummary() {
    $("body").empty();
    SetHeader();
    AnalyzeReworksBySprint();
    AnalyzeIssuesByMonth();
}

function CompareSprint(a, b) {
    var teamA = "";
    var sprintNumberA = 0;
    var teamB = "";
    var sprintNumberB = 0;

    if (a.Sprint != undefined) {
        teamA = a.Sprint.split(' ')[0];;
        sprintNumberA = parseInt(a.Sprint.split(' ')[1]);
    }
    if (b.Sprint != undefined) {
        teamB = b.Sprint.split(' ')[0];
        sprintNumberB = parseInt(b.Sprint.split(' ')[1]);
    }

    if (teamA < teamB)
        return -1;
    else if (teamA > teamB)
        return 1;
    else if (sprintNumberA > sprintNumberB)
        return -1;
    else (sprintNumberA < sprintNumberB)
        return 1;
    return 0;
}

function SortByDate(a, b) {
    var severityA = 5;
    var severityB = 5;
    if (a.Priority === "Critical")
        severityA = 1;
    else if (a.Priority === "High")
        severityA = 2;
    else if (a.Priority === "Medium")
        severityA = 3;
    else if (a.Priority === "Low")
        severityA = 4;
    if (b.Priority === "Critical")
        severityB = 1;
    else if (b.Priority === "High")
        severityB = 2;
    else if (b.Priority === "Medium")
        severityB = 3;
    else if (b.Priority === "Low")
        severityB = 4;

    // Sort by severity first
    if (severityA < severityB)
        return -1;
    else if (severityA > severityB)
        return 1;

    // Sort by Resolved, or created if neither have a Resolved value
    if ((a.Resolved === undefined) && (b.Resolved === undefined)) {
        if (a.Created < b.Created)
            return 1;
        else if (a.Created > b.Created)
            return -1;
        else
            return 0;
    } else if ((a.Resolved === undefined) && (b.Resolved != undefined))
        return 1;
    else if ((a.Resolved != undefined) && (b.Resolved === undefined))
        return -1;
    else if (a.Resolved < b.Resolved)
        return 1;
    else if (a.Resolved > b.Resolved)
        return -1;
    else
        return 0;
}