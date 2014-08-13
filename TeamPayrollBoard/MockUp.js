$(document).ready(function () {
    $("#DevelopBoardCounts").empty();
    $("#RegressionBoardCounts").empty();
    $("#YouTrackItemList").empty();

    CountYouTrackItemsOnBoard("Development", "http://youtrack:9111/rest/issue/byproject/PY?filter=Payroll+Board%3A+Development+State%3A+%7BDesigning+-+Done%7D+..+%7BProduct+Owner+Review%7D+order+by%3A+updated+desc&max=100");
    CountYouTrackItemsOnBoard("Regression", "http://youtrack:9111/rest/issue/byproject/PY?filter=Payroll+Board%3A+Regression+State%3A+%7BDesigning+-+Done%7D+..+%7BProduct+Owner+Review%7D+order+by%3A+updated+desc&max=100");
    GetLatestUpdatedItems("http://youtrack:9111/rest/issue/byproject/PY?filter=Payroll+Board%3A+Development%2C+Regression+State%3A+%7BDesigning+-+Done%7D+..+%7BProduct+Owner+Review%7D+order+by%3A+updated+desc&max=6");
});

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
        }
    });
}

function DisplayLatestUpdatedItems(jsonData) {
    for (var key in jsonData) {
        var youTrackId = "";
        var youTrackTitle = "";
        var youTrackUser = "";
        var youTrackType = "";
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
                    else {
                        console.log(field["name"].toString() + " = " + field["value"].toString());
                    }
                }
            }
        }
        
        DisplayYouTrackItem(boardType, youTrackId, youTrackTitle, youTrackUser, youTrackType, updated);
    }
}

function CountYouTrackItemsOnBoard(boardType, youTrackUrl) {
    $.ajax({
        url: youTrackUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function(jsonData) {
            CountIssues(boardType, jsonData);
        },
        error: function() {
        }
    });
}

function CountIssues(boardType, jsonData) {
    var countDesigningDone = 0;
    var countInProgress = 0;
    var countInProgressDone = 0;
    var countFunctionalTesting = 0;
    var countFunctionalTestingDone = 0;
    var countMergedToDevelop = 0;
    var countIntegrationTesting = 0;
    var countProductOwnerReview = 0;
    var countTotal = 0;
    
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
            countTotal++;

            switch (youTrackState) {
            case "Designing - Done":
                countDesigningDone++;
                break;
            case "In Progress":
                countInProgress++;
                break;
            case "In Progress - Done":
                countInProgressDone++;
                break;
            case "Functional Testing":
                countFunctionalTesting++;
                break;
            case "Functional Testing - Done":
                countFunctionalTestingDone++;
                break;
            case "Merged to develop":
                countMergedToDevelop++;
                break;
            case "Integration Testing":
                countIntegrationTesting++;
                break;
            case "Product Owner Review":
                countProductOwnerReview++;
                break;
            }
        }
    }
    DisplayCounts(boardType, countDesigningDone, countInProgress, countInProgressDone, countFunctionalTesting, countFunctionalTestingDone, countMergedToDevelop, countIntegrationTesting, countProductOwnerReview, countTotal);
}

function DisplayCounts(boardType, countDesigningDone, countInProgress, countInProgressDone, countFunctionalTesting, countFunctionalTestingDone, countMergedToDevelop, countIntegrationTesting, countProductOwnerReview, countTotal) {
    var boardCounts = $("#DevelopBoardCounts");
    if (boardType == "Regression")
        boardCounts = $("#RegressionBoardCounts");

    boardCounts.append('<div class="payroll-board-type">' + boardType + '</div>');
    boardCounts.append('<div class="payroll-board-state"><span>Designing - Done</span><br/><span class="large-text">' + countDesigningDone + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>In Progress</span><br/><span class="large-text">' + countInProgress + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>In Progress - Done</span><br/><span class="large-text">' + countInProgressDone + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>Func. Testing</span><br/><span class="large-text">' + countFunctionalTesting + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>Func. Testing - Done</span><br/><span class="large-text">' + countFunctionalTestingDone + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>Merged to Develop</span><br/><span class="large-text">' + countMergedToDevelop + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>Integration Testing</span><br/><span class="large-text">' + countIntegrationTesting + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>P/O Review</span><br/><span class="large-text">' + countProductOwnerReview + '</span></div>');
    boardCounts.append('<div class="payroll-board-state"><span>Total</span><br/><span class="large-text">' + countTotal + '</span></div>');
}

function DisplayYouTrackItem(boardType, youTrackId, youTrackTitle, youTrackUser, youTrackType, updated) {
    $("#YouTrackItemList").append('<div class="clear"></div><div class="youtrack-item"><div class="youtrack-id">' + youTrackId + '</div><div class="youtrack-body"><span>' + youTrackType + ' : ' + youTrackTitle + '</span><br/><span>Updated by ' + youTrackUser + ' at ' + updated + '</span></div></div>');
}

function ConvertYouTrackDate(milliseconds) {
    var thisDate = new Date(0);
    thisDate.setMilliseconds(milliseconds);

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