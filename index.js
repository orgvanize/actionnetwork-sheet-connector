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

require('dotenv').config();

const { DateTime } = require('luxon');

const ANApi = require('./lib/an_api');
const GoogleApi = require('./lib/google_api');

const syncRSVPs = async () => {
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // get existing sheets
    let sheetsByName = await GoogleApi.getSpreadsheetSheetsByName(spreadsheetId);

    // get AN events, filtered to eliminate events in the past
    const events = (await ANApi.getEvents()).filter(event => {
        return DateTime.fromISO(event.start_date).diffNow('days') > 0;
    });

    // add sheets for any new events
    let addedSheets = false;
    for(const event of events) {
        if(!sheetsByName[event.name]) {
            await GoogleApi.addSheetToSpreadsheet(
                spreadsheetId,
                event.name,
                [
                    'Person ID',
                    'Given Name',
                    'Family Name',
                    'Email',
                    'Phone',
                    'Status'
                ]
            );
            addedSheets = true;
        }
    }

    // refresh sheets if we added any
    if(addedSheets) {
        sheetsByName = await GoogleApi.getSpreadsheetSheetsByName(spreadsheetId);
    }

    // get all people in AN
    // AFAICT, there's no way to batch pull a set of specific person IDs,
    // and getting each signed up person individually results in too many API calls
    // therefore, easier to get everyone and then match them
    const people = await ANApi.getPeople();

    // get attendences for events, and match them with people
    const eventsWithAttendances = await Promise.all(events.map(async (event) => {
        const attendances = await ANApi.getEventAttendances(ANApi.idForItem(event));
        
        const attendancesWithPeople = attendances.map(attendance => {
            return {
                attendance,
                person: ANApi.personFromPeople(attendance['action_network:person_id'], people),
            };
        });
        
        return {
            event,
            attendances: attendancesWithPeople,
        }
    }));

    // update event sheets with attendee data
    for(const eventBundle of eventsWithAttendances) {
        const sheet = sheetsByName[eventBundle.event.name];

        let sheetRowsToAppend = [];

        for(const attBundle of eventBundle.attendances) {
            const attendance = attBundle.attendance;
            const personId = attendance['action_network:person_id'];
            const person = attBundle.person;

            const row = [
                personId,
                person ? person.given_name : null,
                person ? person.family_name : null,
                ANApi.emailForPerson(person),
                ANApi.phoneForPerson(person),
                attendance.status,
            ];

            const foundPersonIdx = !sheet.data || !sheet.data[0] || !sheet.data[0].rowData ? -1
                : sheet.data[0].rowData.findIndex(data => {
                    return data.values[0].formattedValue == personId;
                });

            if(foundPersonIdx > -1) {
                const foundPerson = sheet.data[0].rowData[foundPersonIdx];
                if(!foundPerson) {
                    console.error('cannot find person at idx', foundPersonIdx);
                    continue;
                }

                const currentRow = foundPerson.values.map(v => v.formattedValue || null);
                const needsUpdate = row.join('-') != currentRow.join('-');
                
                //console.log('checking updating', row, currentRow, needsUpdate);

                if(needsUpdate) {
                    //console.log('needs update', row, currentRow, foundPersonIdx + 1);
                    
                    await GoogleApi.updateRowsInSheet(
                        spreadsheetId,
                        eventBundle.event.name,
                        [row],
                        'A',
                        foundPersonIdx + 1,
                    );
                    
                    //console.log('update res', res.data.responses);
                }
            }
            else {
                //console.log('appending', row);
                sheetRowsToAppend.push(row);
            }
        }

        if(sheetRowsToAppend.length > 0) {
            const lastRow = !sheet.data || !sheet.data[0] || !sheet.data[0].rowData ? 1
                : sheet.data[0].rowData.length;
            await GoogleApi.updateRowsInSheet(
                spreadsheetId,
                eventBundle.event.name,
                sheetRowsToAppend,
                'A',
                lastRow + 1,
            );
            /*
            await GoogleApi.appendRowsToSheet(
                spreadsheetId,
                eventBundle.event.name,
                sheetRowsToAppend
            );
            */
        }
    }
}

syncRSVPs();
