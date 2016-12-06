var settings = undefined;
var youTrackIds = [];
var youTrackHeaders = [];
var devStats = [];
var companyYearSummaries = [];
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
    var apiUrl = settings.YouTrackRootUrl + "/rest/issue?filter=project%3ACAS%2C+OCT+Type%3A+%7BUser+Story%7D%2C+Defect%2C+Bug+State%3A+Complete+%2C+Released+resolved+date%3A+2016-05+..+Today++order+by%3A+%7Bissue+id%7D+asc&max=500";

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
        header.CompanyYear = "Unknown";

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") header.Type = field.value[0];
            if (field.name === "summary") header.Title = field.value;
            if (field.name === "Risk") header.Risk = parseInt(field.value[0]);
            if (field.name === "resolved") header.CompanyYear = ConvertYouTrackDateToCompanyYear(field.value);
        }

        if (header.Type == "Bug")
            header.Type = "Defect";

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

        RequestYouTrackIssueData(apiUrl, youTrackHeader.Id, youTrackHeader.Type, youTrackHeader.Title, youTrackHeader.Risk, youTrackHeader.CompanyYear);
    }

    WaitToDisplayResults();
}

function RequestYouTrackIssueData(apiUrl, issueId, issueType, issueTitle, issueRisk, issueCompanyYear) {
    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeYouTrackIssueData(jsonData, issueId, issueType, issueTitle, issueRisk, issueCompanyYear);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function AnalyzeYouTrackIssueData(youTrackData, issueId, issueType, issueTitle, issueRisk, issueCompanyYear) {
    var devStat = new Object();
    devStat.Id = issueId;
    devStat.Title = issueTitle;
    devStat.Type = issueType;
    devStat.Risk = issueRisk;
    devStat.CompanyYear = issueCompanyYear;
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
    var developers = settings.Developers.sort(SortByFullName);
    var companyYears = [];
    companyYears.push(2016);

    var markUp = "<div class='filter-bar'>";
    markUp += "Developer:&nbsp;<select id='dev-filter' class='devstat-filter'>";

    for (var devIndex in developers) {
        var developer = developers[devIndex];

        if (developer.ResourceType !== "Developer") continue;

        markUp += "<option value='" + developer.FullName + "'>" + developer.FullName + "</option>";
    }

    markUp += "</select>";
    markUp += "&nbsp;Type:&nbsp;";
    markUp += "<select id='type-filter' class='devstat-filter'>";
    markUp += "<option value='All'>All</option>";
    markUp += "<option value='User Story'>User Story</option>";
    markUp += "<option value='Defect'>Defect</option>";
    markUp += "</select>";
    markUp += "&nbsp;Company Year:&nbsp;";
    markUp += "<select id='company-year-filter' class='devstat-filter'>";
    markUp += "<option value='All'>All</option>";

    for (var companyYearIndex in companyYears) {
        var companyYear = companyYears[companyYearIndex];
        markUp += "<option value='" + companyYear + "'>" + companyYear + "/" + (companyYear + 1) + "</option>";
    }

    markUp += "</select>";
    markUp += "&nbsp;Include Not Exceeded:&nbsp;";
    markUp += "<input type='checkbox' id='include-not-exceeded' class='devstat-filter' checked />"
    markUp += "</div>";

    $("body").append(markUp);

    $(".devstat-filter").change(function () {
        DisplayDevStats();
    });

    DisplayDevStats();
}

function DisplayDevStats() {
    var selectedDevName = $("select#dev-filter").val();
    var selectedType = $("select#type-filter").val();
    var selectedCompanyYear = $("select#company-year-filter").val();
    var includeNotExceeded = $("input#include-not-exceeded").is(":checked");
    var totalDefects = 0.0;
    var defectReturn = 0.0;
    var totalUserStories = 0.0;
    var userStoryReturn = 0.0;
    var totalEstimatedForYear = 0.0;
    var totalEstimatedForYearForDev = 0.0;
    var totalActualForYear = 0.0;
    var totalActualForYearForDev = 0.0;
    var numberExceedingRework = 0;
    companyYearSummaries = [];

    $("table#dev-breakdown").remove();
    $("table#dev-summary").remove();

    var markUp = "<table class='datatable' id='dev-breakdown'>";
    markUp += "<tr>";
    markUp += "<th class='text-cell'>Company Year</th>";
    markUp += "<th class='numeric-cell'>Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Estimate</th>";
    markUp += "<th class='text-cell'>Actual</th>";
    markUp += "<th class='numeric-cell'>Contribution</th>";
    markUp += "<th class='numeric-cell'>Reworks</th>";
    markUp += "<th class='numeric-cell'>Rework Limit</th>";
    markUp += "<th class='text-cell'>Rework Limit Exceeded</th>";
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
                var exceedsReworks = (maximumReworks < devStat.NumberOfReworks);

                UpdateCompanyYear(devStat.Type, devStat.CompanyYear, contribution, exceedsReworks);

                if (selectedType === "User Story" && devStat.Type !== "User Story") continue;
                if (selectedType === "Defect" && devStat.Type === "User Story") continue;
                if (selectedCompanyYear !== "All" && devStat.CompanyYear !== parseInt(selectedCompanyYear)) continue;
                if (!includeNotExceeded && !exceedsReworks) continue;

                totalEstimatedForYearForDev += dev.TotalEstimatedDev;
                totalActualForYearForDev += dev.TotalActualDev;
                if (exceedsReworks)
                    numberExceedingRework += 1;

                markUp += "<tr>";
                markUp += "<td class='text-cell'>" + devStat.CompanyYear + "</td>";
                markUp += "<td class='numeric-cell' nowrap><a href='" + settings.YouTrackRootUrl + "/issue/" + devStat.Id + "' target='_blank'>" + devStat.Id + "</a></td>";
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

    // Footer
    markUp += "<tr>";
    markUp += "<th class='text-cell' colspan='4'>Developer Totals</th>";
    markUp += "<th class='text-cell'>" + totalEstimatedForYearForDev + "</th>";
    markUp += "<th class='text-cell'>" + totalActualForYearForDev + "</th>";
    markUp += "<th class='numeric-cell' colspan='3'>&nbsp;</th>";
    markUp += "<th class='text-cell'>" + numberExceedingRework + "</th>";
    markUp += "</tr>";

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
    summaryMarkUp += "<th class='text-cell'>Company Year</th>";
    summaryMarkUp += "<th class='numeric-cell'>User Story Contribution</th>";
    summaryMarkUp += "<th class='numeric-cell'>User Story Return</th>";
    summaryMarkUp += "<th class='numeric-cell'>Defect Contribution</th>";
    summaryMarkUp += "<th class='numeric-cell'>Defect Return</th>";
    summaryMarkUp += "<th class='numeric-cell'>Overall Contribution</th>";
    summaryMarkUp += "<th class='numeric-cell'>Overall Return</th>";
    summaryMarkUp += "</tr>";

    companyYearSummaries.sort(CompareCompanyYearSummaries);

    var totalUserStories = 0.0;
    var totalUserStoryReturn = 0.0;
    var totalDefects = 0.0;
    var totalDefectReturn = 0.0;
    var totalEffort = 0.0;
    var totalEffortReturn = 0.0;

    for (var companyYearIndex in companyYearSummaries) {
        var companyYearSummary = companyYearSummaries[companyYearIndex];

        totalUserStories += companyYearSummary.TotalUserStories;
        totalUserStoryReturn += companyYearSummary.UserStoryReturn;
        totalDefects += companyYearSummary.TotalDefects;
        totalDefectReturn += companyYearSummary.DefectReturn;
        totalEffort += companyYearSummary.TotalUserStories;
        totalEffort += companyYearSummary.TotalDefects;
        totalEffortReturn += companyYearSummary.UserStoryReturn;
        totalEffortReturn += companyYearSummary.DefectReturn;

        var userStoryReturnPercentage = 100.0 * (companyYearSummary.UserStoryReturn / companyYearSummary.TotalUserStories);
        var defectReturnPercentage = 100.0 * (companyYearSummary.DefectReturn / companyYearSummary.TotalDefects);
        var effortReturnPercentage = 100.0 * ((companyYearSummary.UserStoryReturn + companyYearSummary.DefectReturn) / (companyYearSummary.TotalUserStories + companyYearSummary.TotalDefects));

        if (isNaN(userStoryReturnPercentage)) userStoryReturnPercentage = 0;
        if (isNaN(defectReturnPercentage)) defectReturnPercentage = 0;
        if (isNaN(effortReturnPercentage)) effortReturnPercentage = 0;

        summaryMarkUp += "<tr>";
        summaryMarkUp += "<td class='text-cell'>" + companyYearSummary.CompanyYear + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(companyYearSummary.TotalUserStories) + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(userStoryReturnPercentage) + "%</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(companyYearSummary.TotalDefects) + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(defectReturnPercentage) + "%</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(companyYearSummary.TotalUserStories + companyYearSummary.TotalDefects) + "</td>";
        summaryMarkUp += "<td class='numeric-cell'>" + FormatNumberToString(effortReturnPercentage) + "%</td>";
        summaryMarkUp += "</tr>";
    }

    var totalUserStoryReturnPercentage = 100.0 * (totalUserStoryReturn / totalUserStories);
    var totalDefectReturnPercentage = 100.0 * (totalDefectReturn / totalDefects);
    var totalEffortReturnPercentage = 100.0 * (totalEffortReturn / totalEffort);

    if (isNaN(totalUserStoryReturnPercentage)) totalUserStoryReturnPercentage = 0;
    if (isNaN(totalDefectReturnPercentage)) totalDefectReturnPercentage = 0;
    if (isNaN(totalEffortReturnPercentage)) totalEffortReturnPercentage = 0;

    summaryMarkUp += "<tr>";
    summaryMarkUp += "<th class='text-cell'>Overall</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalUserStories) + "</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalUserStoryReturnPercentage) + "%</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalDefects) + "</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalDefectReturnPercentage) + "%</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalEffort) + "</th>";
    summaryMarkUp += "<th class='numeric-cell'>" + FormatNumberToString(totalEffortReturnPercentage) + "%</th>";
    summaryMarkUp += "</tr>";

    summaryMarkUp += "</table>";

    return summaryMarkUp;
}

function UpdateCompanyYear(issueType, companyYear, contribution, exceedsRework) {
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

    for (var companyYearIndex in companyYearSummaries) {
        var companyYearSummary = companyYearSummaries[companyYearIndex];

        if (companyYearSummary.CompanyYear === companyYear) {
            companyYearSummary.TotalUserStories += userStory;
            companyYearSummary.UserStoryReturn += userStoryReturn;
            companyYearSummary.TotalDefects += defect;
            companyYearSummary.DefectReturn += defectReturn;
            updated = true;
        }
    }

    if (!updated) {
        var newCompanyYearSummary = new Object();
        newCompanyYearSummary.CompanyYear = companyYear
        newCompanyYearSummary.TotalUserStories = userStory;
        newCompanyYearSummary.UserStoryReturn = userStoryReturn;
        newCompanyYearSummary.TotalDefects = defect;
        newCompanyYearSummary.DefectReturn = defectReturn;
        companyYearSummaries.push(newCompanyYearSummary);
    }
}

function ConvertYouTrackDateToCompanyYear(milliseconds) {
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
    if (month <= 4) year -= 1;

    return year;
}

function FormatNumberToString(numberToFormat) {
    return parseFloat(Math.round(numberToFormat * 100) / 100).toFixed(2);
}

function CompareCompanyYearSummaries(a, b) {
    if (a.CompanyYear < b.CompanyYear)
        return 1;
    else if (a.CompanyYear > b.CompanyYear)
        return -1;
    else
        return 0;
}

function CompareDevStats(a, b) {
    var issueIdA = parseInt(a.Id.replace("CAS-", ""));
    var issueIdB = parseInt(b.Id.replace("CAS-", ""));

    if (a.CompanyYear < b.CompanyYear)
        return 1;
    else if (a.CompanyYear > b.CompanyYear)
        return -1;
    else if (issueIdA > issueIdB)
        return -1;
    else if (issueIdA < issueIdB)
        return 1;
    else
        return 0;
}

function SortByFullName(a, b) {
    var aNameParts = a.FullName.split(" ");
    var bNameParts = b.FullName.split(" ");

    aForeName = aNameParts[0];
    aSurname = aNameParts[aNameParts.length - 1];

    bForeName = bNameParts[0];
    bSurname = bNameParts[bNameParts.length - 1];

    if (aSurname < bSurname)
        return -1;
    else if (aSurname > bSurname)
        return 1;
    else if (aForeName < bForeName)
        return -1;
    else if (aForeName > bForeName)
        return 1;
    else
        return 0;
}