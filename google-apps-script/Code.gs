/**
 * Script Google Apps Script pour Google Drive / Sheets.
 * 1. Ouvrez https://sheets.new dans Google Drive
 * 2. Extensions > Apps Script
 * 3. Collez ce code et cliquez sur Déployer > Nouveau déploiement > Application Web
 * 4. Accès : Tout le monde
 */

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    sheet.getRange("A1").setValue(JSON.stringify(contents.data));
    sheet.getRange("B1").setValue(new Date().toISOString());

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: contents.data,
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var raw = sheet.getRange("A1").getValue();
    var data = raw ? JSON.parse(raw) : null;

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
