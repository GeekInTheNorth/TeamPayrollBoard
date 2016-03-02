var settings = undefined;
var requestsMade = 0;
var requestsCompleted = 0;
var issuedLogged = [];
var youTrackIssues = [];

function StartIssueCheck() {
    $.ajax({
        type: "Get",
        url: "./Data/SiteSettings.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            CheckIssues();
        }
    });
}

function CheckIssues() {
    $("#table-issue-results").remove();
    var text = $("#you-track-issues-to-check").val();

    text = text.replace(/[\n\r]/g, '@@');
    text = text.replace(/[\r\n]/g, '@@');
    text = text.replace(/[\r]/g, '@@');
    text = text.replace(/[\n]/g, '@@');
    text = text.replace(/[,]/g, '@@');

    var codes = text.split("@@");
    var urlSearch = "";
    requestsMade = 0;
    requestsCompleted = 0;
    issuedLogged = [];
    youTrackIssues = [];
    
    for (var codeLocation in codes)
    {
        var codeText = codes[codeLocation].toUpperCase().trim();
        codeText = codeText.replace("UAT/CASCADE/", "");
        codeText = codeText.replace("UAT/HR/", "");
        codeText = codeText.replace("UAT/UI/", "");
        codeText = codeText.replace("UAT/3RDLINE/", "");

        if (codeText.startsWith("CAS-") || codeText.startsWith("HR-") || codeText.startsWith("PY-"))
        {
            requestsMade++;
            RequestData(codeText);
        }
    }

    setTimeout(function () { DisplaySummaryWhenReady() }, 1000);
}

function RequestData(youTrackId)
{
    urlSearch = settings.YouTrackRootUrl + "/rest/issue?filter=issue+id%3A+" + youTrackId;

    $.ajax({
        url: urlSearch,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            ConvertYouTrackDataToObjects(jsonData, youTrackIssues, issuedLogged)
            requestsCompleted++;
        },
        error: function () {
            requestsCompleted++;
        }
    });
}

function DisplayData() {
    youTrackIssues.sort(CompareYouTrackId);
    var markUp = "<table id='table-issue-results' class='datatable'>"
    markUp += "<tr>";
    markUp += "<th class='numeric-cell'>ID</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Module</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>State</th>";
    markUp += "<th class='text-cell'>Sprint</th>";
    markUp += "</tr>";
    markUp += "</table>";
    $("body").append(markUp);

    for (var issueLocation in youTrackIssues) {
        var youTrackIssue = youTrackIssues[issueLocation];
        markUp = "<tr>";
        markUp += "<td class='numeric-cell'><a href='" + settings.YouTrackRootUrl + "/issue/" + youTrackIssue.IssueId + "' target='_blank'>" + youTrackIssue.IssueId + "</a></td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Type + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Subsystem + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Title + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.State + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Sprint + "</td>";
        markUp += "</tr>";

        $("#table-issue-results tr:last").after(markUp);
    }

    $("table#table-issue-results tr:even").addClass("alternate-row");
    $("table#table-issue-results tr:odd").addClass("normal-row");
}

function DisplaySummaryWhenReady() {
    if (requestsMade === requestsCompleted) {
        DisplayData();
    }
    else {
        setTimeout(function () { DisplaySummaryWhenReady() }, 1000);
    }
}

function RemoveInProgress() {
    var rowIds = [];

    //run through each row
    $('#table-issue-results tr').each(function (i, row) {
        var issueType = row.children[1].innerText;
        var issueState = row.children[4].innerText;

        if (((issueType === "Bug") && (issueState === "Done")) || (issueState.startsWith("In Progress")) || (issueState === "Ready to Start") || (issueState === "Designing") || (issueState === "Submitted"))
            rowIds.push(i);
    });

    rowIds.sort(CompareRowIndexs);

    var table = $('#table-issue-results');
    for (var loop in rowIds)
    {
        var idToRemove = parseInt(rowIds[loop]);

        $("#table-issue-results tr").eq(idToRemove).remove();
    }

    $("table#table-issue-results tr").removeClass("alternate-row");
    $("table#table-issue-results tr").removeClass("normal-row");
    $("table#table-issue-results tr:even").addClass("alternate-row");
    $("table#table-issue-results tr:odd").addClass("normal-row");
}

function CompareRowIndexs(a, b) {
    var indexA = parseInt(a);
    var indexB = parseInt(b);

    if (indexA > indexB)
        return -1;
    else if (indexA < indexB)
        return 1;
    else
        return 0;
}

function CompareYouTrackId(a, b) {
    var itemAProject = a.IssueId.split('-')[0];
    var itemANumber = parseInt(a.IssueId.split('-')[1]);

    var itemBProject = b.IssueId.split('-')[0];
    var itemBNumber = parseInt(b.IssueId.split('-')[1]);

    if (itemAProject > itemBProject)
        return 1;
    else if (itemAProject < itemBProject)
        return -1;
    else if (itemANumber > itemBNumber)
        return 1
    else if (itemANumber < itemBNumber)
        return -1
    else
        return 0;
}