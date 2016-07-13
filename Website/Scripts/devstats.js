var youTrackIds = [];
var youTrackHeaders = [];
var devStats = [];
var quarterlySummaries = [];
var apiStarted = 0;
var apiCompleted = 0;
var issuesToAnalyze = 0;

$(document).ready(function () {
    StartDataLoad();
});

function StartDataLoad() {
    $("body").empty();

    DrawHeader();

    LoadSettings();
}

function DrawHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function LoadSettings() {
    $.ajax({
        type: "Get",
        url: "./Data/SiteSettings.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            LoadHeadersFromYouTrack();
        }
    });
}

function LoadHeadersFromYouTrack() {
    var apiUrl = settings.YouTrackRootUrl + "/rest/issue?filter=project%3ACAS+Type%3A+%7BUser+Story%7D%2C+Defect+State%3A+Complete+%2C+Released+Subsystem%3A+-UI+%2C+-%7BUI+(iPad)%7D+order+by%3A+%7Bissue+id%7D+asc&max=500";

    $("body").append("<div class='progress'>Loading Headers from You Track.</div>");

    apiStarted++;

    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            StoreYouTrackHeaders(jsonData);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });

    setTimeout(function () { WaitToLoadYouTrackIssueData() }, 1000);
}

function StoreYouTrackHeaders(youTrackData) {
    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];

        if (youTrackIds.indexOf(task.id) > -1) continue;

        youTrackIds.push(task.id);

        var header = new Object();
        header.Type = "User Story";
        header.Id = task.id;
        header.Risk = "Medium";
        header.Quarter = "Unknown";

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") header.Type = field.value[0];
            if (field.name === "summary") header.Title = field.value;
            if (field.name === "Risk") header.Risk = parseInt(field.value[0]);
            if (field.name === "resolved") header.Quarter = ConvertYouTrackDateToQuarter(field.value);
        }

        youTrackHeaders.push(header);
    }
}

function WaitToLoadYouTrackIssueData() {
    if (apiStarted > apiCompleted)
        setTimeout(function () { WaitToLoadYouTrackIssueData() }, 1000);
    else
        LoadYouTrackIssueData();
}

function LoadYouTrackIssueData(){
    for (var headerIndex in youTrackHeaders) {
        var youTrackHeader = youTrackHeaders[headerIndex];
        var apiUrl = settings.YouTrackRootUrl + "/rest/issue?filter=Subtask+of%3A+" + youTrackHeader.Id + "+State%3A+Complete+..+Released&max=500";

        apiStarted++;

        RequestYouTrackIssueData(apiUrl, youTrackHeader.Id, youTrackHeader.Type, youTrackHeader.Title, youTrackHeader.Risk, youTrackHeader.Quarter);
    }

    WaitToDisplayResults();
}

function RequestYouTrackIssueData(apiUrl, issueId, issueType, issueTitle, issueRisk, issueQuarter) {
    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeYouTrackIssueData(jsonData, issueId, issueType, issueTitle, issueRisk, issueQuarter);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function AnalyzeYouTrackIssueData(youTrackData, issueId, issueType, issueTitle, issueRisk, issueQuarter) {
    var devStat = new Object();
    devStat.Id = issueId;
    devStat.Title = issueTitle;
    devStat.Type = issueType;
    devStat.Risk = issueRisk;
    devStat.Quarter = issueQuarter;
    devStat.TotalActualDev = 0;
    devStat.TotalEstimatedDev = 0;
    devStat.TotalActualQA = 0;
    devStat.TotalEstimatedQA = 0;
    devStat.NumberOfReworks = 0;
    devStat.TotalActualRework = 0;
    devStat.DevContributors = [];

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var taskType = "Unknown";
        var taskEstimate = 0;
        var taskActual = 0;
        var taskOwner = "Unknown";
        var updatedOwner = false;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") taskType = field.value[0];
            if (field.name === "Estimate") taskEstimate = parseInt(field.value[0]);
            if (field.name === "ActualTime") taskActual = parseInt(field.value[0]);
            if (field.name === "Assignee") taskOwner = field.value[0].fullName;
        }

        if (taskActual === 0 && taskEstimate !== 0)
            taskActual = taskEstimate;

        if (taskType == "Task") {
            devStat.TotalActualDev += taskActual;
            devStat.TotalEstimatedDev += taskEstimate;

            for (var devIndex in devStat.DevContributors) {
                var dev = devStat.DevContributors[devIndex];

                if (dev.FullName === taskOwner) {
                    dev.TotalActualDev += taskActual;
                    dev.TotalEstimatedDev += taskEstimate;
                    updatedOwner = true;
                }
            }

            if (!updatedOwner) {
                var newDev = new Object();
                newDev.FullName = taskOwner;
                newDev.TotalActualDev = taskActual;
                newDev.TotalEstimatedDev = taskEstimate;

                devStat.DevContributors.push(newDev);

                updatedOwner = true;
            }
        }
        else if (taskType == "Testing Task") {
            devStat.TotalActualQA += taskActual;
            devStat.TotalEstimatedQA += taskEstimate;
        }
        else if (taskType == "Rework Task") {
            devStat.NumberOfReworks++;
            devStat.TotalActualRework += taskActual;
        }
    }

    devStats.push(devStat);
}

function WaitToDisplayResults() {
    if (apiStarted > apiCompleted) {
        setTimeout(function () { WaitToDisplayResults() }, 1000);
        DisplayProgress();
    }
    else
        DisplayResults();
}

function DisplayProgress() {
    $("div.progress").remove();

    var markUp = "<div class='progress'>";
    markUp += "Processing: " + apiCompleted + " of " + apiStarted + " items completed.";
    markUp += "</div>";

    $("body").append(markUp);
}

function DisplayResults() {
    $("div.progress").remove();

    DisplayFilter();
}

function DisplayFilter() {
    var devNames = [];
    var quarters = [];

    for (var devStatIndex in devStats) {
        var devStat = devStats[devStatIndex];

        if (quarters.indexOf(devStat.Quarter) === -1)
            quarters.push(devStat.Quarter);

        for (var devIndex in devStat.DevContributors) {
            var dev = devStat.DevContributors[devIndex];

            if (devNames.indexOf(dev.FullName) > -1) continue;

            devNames.push(dev.FullName);
        }
    }

    devNames.sort();
    quarters.sort();
    quarters.reverse();

    var markUp = "<div class='filter-bar'>";
    markUp += "Developer:&nbsp;<select id='dev-filter' class='devstat-filter'>";

    for (var devNameIndex in devNames) {
        var devName = devNames[devNameIndex];

        if (devName === "Unknown" || devName === "I'm Blocked") continue;

        markUp += "<option value='" + devName + "'>" + devName + "</option>";
    }

    markUp += "</select>";
    markUp += "&nbsp;Type:&nbsp;";
    markUp += "<select id='type-filter' class='devstat-filter'>";
    markUp += "<option value='All'>All</option>";
    markUp += "<option value='User Story'>User Story</option>";
    markUp += "<option value='Defect'>Defect</option>";
    markUp += "</select>";
    markUp += "&nbsp;Quarter:&nbsp;";
    markUp += "<select id='quarter-filter' class='devstat-filter'>";
    markUp += "<option value='All'>All</option>";

    for (var quarterIndex in quarters) {
        markUp += "<option value='" + quarters[quarterIndex] + "'>" + quarters[quarterIndex] + "</option>";
    }

    markUp += "</select>";
    quarters
    markUp += "</div>";

    $("body").append(markUp);

    $("select.devstat-filter").change(function () {
        DisplayDevStats();
    });

    DisplayDevStats();
}

function DisplayDevStats() {
    var selectedDevName = $("select#dev-filter").val();
    var selectedType = $("select#type-filter").val();
    var selectedQuarter = $("select#quarter-filter").val();
    var totalDefects = 0.0;
    var defectReturn = 0.0;
    var totalUserStories = 0.0;
    var userStoryReturn = 0.0;
    quarterlySummaries = [];

    $("table#dev-breakdown").remove();
    $("table#dev-summary").remove();

    var markUp = "<table class='datatable' id='dev-breakdown'>";
    markUp += "<tr>";
    markUp += "<th class='text-cell'>Quarter</th>";
    markUp += "<th class='numeric-cell'>Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Estimate</th>";
    markUp += "<th class='text-cell'>Actual</th>";
    markUp += "<th class='numeric-cell'>Contribution</th>";
    markUp += "<th class='numeric-cell'>Reworks</th>";
    markUp += "<th class='numeric-cell'>Max Reworks</th>";
    markUp += "<th class='text-cell'>Reworks Exceeded</th>";
    markUp += "</tr>";

    devStats.sort(CompareDevStats);

    for (var devStatIndex in devStats) {
        var devStat = devStats[devStatIndex];

        for (var devIndex in devStat.DevContributors) {
            var dev = devStat.DevContributors[devIndex];

            if (dev.TotalActualDev === 0) continue;

            if (dev.FullName === selectedDevName) {
                var contribution = (dev.TotalActualDev / devStat.TotalActualDev);
                var contributionPercentage = 100.0 * contribution;
                var maximumReworks = Math.round(devStat.TotalEstimatedDev / 10);
                var exceedsReworks = false;
                
                if (devStat.Risk === "High") maximumReworks = maximumReworks * 2;
                if (devStat.Risk === "Low") maximumReworks = maximumReworks / 2;

                exceedsReworks = (maximumReworks < devStat.NumberOfReworks);

                UpdateQuarter(devStat.Type, devStat.Quarter, contribution, exceedsReworks);

                if (selectedType === "User Story" && devStat.Type !== "User Story") continue;
                if (selectedType === "Defect" && devStat.Type === "User Story") continue;
                if (selectedQuarter !== "All" && devStat.Quarter !== selectedQuarter) continue;

                markUp += "<tr>";
                markUp += "<td class='text-cell'>" + devStat.Quarter + "</td>";
                markUp += "<td class='numeric-cell'><a href='" + settings.YouTrackRootUrl + "/issue/" + devStat.Id + "' target='_blank'>" + devStat.Id + "</a></td>";
                markUp += "<td class='text-cell'>" + devStat.Type + "</td>";
                markUp += "<td class='text-cell'>" + htmlEncode(devStat.Title) + "</td>";                
                markUp += "<td class='text-cell'>" + dev.TotalEstimatedDev + " of " + devStat.TotalEstimatedDev + "</td>";
                markUp += "<td class='text-cell'>" + dev.TotalActualDev + " of " + devStat.TotalActualDev + "</td>";
                markUp += "<td class='numeric-cell'>" + FormatNumberToString(contributionPercentage) + " %</td>";
                markUp += "<td class='numeric-cell'>" + devStat.NumberOfReworks + "</td>";
                markUp += "<td class='numeric-cell'>" + maximumReworks + "</td>";

                if (maximumReworks < devStat.NumberOfReworks)
                    markUp += "<td class='text-cell'>Yes</td>";
                else
                    markUp += "<td class='text-cell'>No</td>";

                markUp += "</tr>";
            }
        }
    }

    markUp += "</table>";

    var userStoryReturnPercentage = 100.0 * userStoryReturn / totalUserStories;
    if (userStoryReturnPercentage === NaN) userStoryReturnPercentage = 0;

    var defectReturnPercentage = 100.0 * defectReturn / totalDefects;
    if (defectReturnPercentage === NaN) defectReturnPercentage = 0;

    var summaryMarkUp = GetSummaryMarkup();

    $("body").append(summaryMarkUp);
    $("body").append(markUp);

    ShowRowColoursForBreakdowns();
}

function GetSummaryMarkup() {
    var summaryMarkUp = "<table class='datatable' id='dev-summary' style='margin-bottom: 10px;'>";
    summaryMarkUp += "<tr>";
    summaryMarkUp += "<th class='text-cell'>Quarter</th>";
    summaryMarkUp += "<th class='numeric-cell'>User Story Contribution</th>";
    summaryMarkUp += "<th class='numeric-cell'>User Story Return</th>";
    summaryMarkUp += "<th class='numeric-cell'>Defect Contribution</th>";
    summaryMarkUp += "<th class='numeric-cell'>Defect Return</th>";
    summaryMarkUp += "</tr>";

    quarterlySummaries.sort(CompareQuarterlySummaries);

    var totalUserStories = 0;
    var totalUserStoryReturn = 0;
    var totalDefects = 0;
    var totalDefectReturn = 0;

    for (var quarterIndex in quarterlySummaries) {
        var quarterSummary = quarterlySummaries[quarterIndex];

        totalUserStories += quarterSummary.TotalUserStories;
        totalUserStoryReturn += quarterSummary.UserStoryReturn;
        totalDefects += quarterSummary.TotalDefects;
        totalDefectReturn += quarterSummary.DefectReturn;

        var userStoryReturnPercentage = 100.0 * (quarterSummary.UserStoryReturn / quarterSummary.TotalUserStories);
        var defectReturnPercentage = 100.0 * (quarterSummary.DefectReturn / quarterSummary.TotalDefects);

        if (isNaN(userStoryReturnPercentage)) userStoryReturnPercentage = 0;
        if (isNaN(defectReturnPercentage)) defectReturnPercentage = 0;

        summaryMarkUp += "<tr>";
        summaryMarkUp += "<td class='text-cell'>" + quarterSummary.Quarter + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(quarterSummary.TotalUserStories) + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(userStoryReturnPercentage) + "%</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(quarterSummary.TotalDefects) + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(defectReturnPercentage) + "%</td>";
        summaryMarkUp += "</tr>";
    }

    var totalUserStoryReturnPercentage = 100.0 * (totalUserStoryReturn / totalUserStories);
    var totalDefectReturnPercentage = 100.0 * (totalDefectReturn / totalDefects);

    if (isNaN(totalUserStoryReturnPercentage)) totalUserStoryReturnPercentage = 0;
    if (isNaN(totalDefectReturnPercentage)) totalDefectReturnPercentage = 0;

    summaryMarkUp += "<tr>";
    summaryMarkUp += "<th class='text-cell'>All</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalUserStories) + "</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalUserStoryReturnPercentage) + "%</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalDefects) + "</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalDefectReturnPercentage) + "%</th>";
    summaryMarkUp += "</tr>";

    summaryMarkUp += "</table>";

    return summaryMarkUp;
}

function UpdateQuarter(issueType, quarter, contribution, exceedsRework) {
    var updated = false;
    var userStory = 0;
    var userStoryReturn = 0;
    var defect = 0;
    var defectReturn = 0;

    if (issueType === "User Story") {
        userStory += contribution;
        if (exceedsRework)
            userStoryReturn += contribution;
    }
    else {
        defect += contribution;
        if (exceedsRework)
            defectReturn += contribution;
    }

    for (var quarterIndex in quarterlySummaries) {
        var quarterSummary = quarterlySummaries[quarterIndex];

        if (quarterSummary.Quarter === quarter) {
            quarterSummary.TotalUserStories += userStory;
            quarterSummary.UserStoryReturn += userStoryReturn;
            quarterSummary.TotalDefects += defect;
            quarterSummary.DefectReturn += defectReturn;
            updated = true;
        }
    }

    if (!updated) {
        var newQuarterSummary = new Object();
        newQuarterSummary.Quarter = quarter
        newQuarterSummary.TotalUserStories = userStory;
        newQuarterSummary.UserStoryReturn = userStoryReturn;
        newQuarterSummary.TotalDefects = defect;
        newQuarterSummary.DefectReturn = defectReturn;
        quarterlySummaries.push(newQuarterSummary);
    }
}

function ConvertYouTrackDateToQuarter(milliseconds) {
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

    var month = thisDate.getMonth() + 1;
    var year = thisDate.getFullYear();
    var quarter = "Q1";

    if (month === 4 || month === 5 || month == 6) quarter = "Q2";
    if (month === 7 || month === 8 || month == 9) quarter = "Q3";
    if (month === 10 || month === 11 || month == 12) quarter = "Q4";

    quarter = year + " " + quarter;

    return quarter;
}

function FormatNumberToString(numberToFormat) {
    return parseFloat(Math.round(numberToFormat * 100) / 100).toFixed(2);
}

function CompareQuarterlySummaries(a, b) {
    if (a.Quarter < b.Quarter)
        return 1;
    else if (a.Quarter > b.Quarter)
        return -1;
    else
        return 0;
}

function CompareDevStats(a, b) {
    var issueIdA = parseInt(a.Id.replace("CAS-", ""));
    var issueIdB = parseInt(b.Id.replace("CAS-", ""));

    if (a.Quarter < b.Quarter)
        return 1;
    else if (a.Quarter > b.Quarter)
        return -1;
    else if (issueIdA > issueIdB)
        return -1;
    else if (issueIdA < issueIdB)
        return 1;
    else
        return 0;
}

function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.
    return $('<div/>').text(value).html();
}