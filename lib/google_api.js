// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//
// Copyright (C) 2020, Josh Cain
// Copyright (C) 2020, The Vanguard Campaign Corps Mods (vanguardcampaign.org)

const { google } = require('googleapis');
const { sheets } = require('googleapis/build/src/apis/sheets');

const client = new google.auth.GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

const sheetsApi = google.sheets({ version: 'v4', auth: client });

const getSpreadsheet = async (spreadsheetId) => {    
    return await sheetsApi.spreadsheets.get({
        includeGridData: true,
        spreadsheetId: spreadsheetId,
    });
};

const getSpreadsheetSheetsByName = async (spreadsheetId) => {
    const spreadsheet = await getSpreadsheet(spreadsheetId);
    return spreadsheet.data.sheets.reduce((carry, sheet) => {
        carry[sheet.properties.title] = sheet;
        return carry;
    }, {});
}

const addSheetToSpreadsheet = async (spreadsheetId, sheetName, headers = false) => {
    const requests = [
        {
            addSheet: {
                properties: {
                    title: sheetName,
                    gridProperties: {
                        frozenRowCount: headers ? 1 : 0,
                    }
                }
            },
        },
    ];
    
    const res = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests
        }
    });

    if(headers) {
        appendRowToSheet(spreadsheetId, sheetName, headers);
    }

    return res;
}

const appendRowToSheet = async (spreadsheetId, sheetName, rowData) => {    
    return await sheetsApi.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1:A1`,
        requestBody: {
            values: [rowData],
        },
        valueInputOption: 'USER_ENTERED',
    });
}

const updateRowsInSheet = async (spreadsheetId, sheetName, rows, startColumn = 'A', startRow = 2) => {
    return await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            data: [{
                range: `${sheetName}!${startColumn}${startRow}`,
                values: rows
            }]
        }
    });
}

const GoogleApi = {
    addSheetToSpreadsheet,
    getSpreadsheet,
    getSpreadsheetSheetsByName,
    appendRowToSheet,
    updateRowsInSheet,
};

module.exports = GoogleApi;
