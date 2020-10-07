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

const axios = require('axios').default;

//let callCount = 0;

const runApiCall = async (method, route, data = undefined) => {
    try {
        const result = await axios({
            method,
            url: `${process.env.AN_API_BASE}${route}`,
            data,
            headers: {
                'OSDI-API-Token': process.env.AN_API_KEY,
            }
        });

        //callCount++;

        return result.data;
    }
    catch(e) {
        console.error(`Error running AN API call to ${route}: ${e.message || e}`);
        process.exit(1);
    }
};

const getEvents = async (href = 'events/', events = []) => {
    const result = await runApiCall('GET', href);
    events = events.concat(result._embedded['osdi:events']);
    if(result._links && result._links['next'] && result._links['next'].href != href) {
        events = await getEvents(result._links['next'].href.replace(process.env.AN_API_BASE, ''), events);
    }
    return events;
};

const getEventAttendances = async (eventId) => {
    const result = await runApiCall('GET', `events/${eventId}/attendances`);
    return result._embedded['osdi:attendances'];
}

const getPeople = async (href = 'people/', people = []) => {
    const result = await runApiCall('GET', href);
    people = people.concat(result._embedded['osdi:people']);
    if(result._links && result._links['next'] && result._links['next'].href != href) {
        people = await getPeople(result._links['next'].href.replace(process.env.AN_API_BASE, ''), people);
    }
    return people;
}

const getPerson = async (personId) => {
    return await runApiCall('GET', `people/${personId}`);
};

const idForItem = (item) => {
    if(!item) { return null; }
    return item.identifiers[0].replace('action_network:', '');
}

const personFromPeople = (personId, people) => {
    return people.find(p => {
        return !!p.identifiers.find(i => i.indexOf(personId) > -1);
    });
}

const emailForPerson = person => {
    if(!person) { return null; }
    const addr = person.email_addresses.find(a => {
        return a.primary;
    });
    return addr ? addr.address : null;
}

const phoneForPerson = person => {
    if(!person) { return null; }
    const num = person.phone_numbers.find(a => {
        return a.primary;
    });
    return num ? num.number : null;
}

const ANApi = {
    runApiCall,
    emailForPerson,
    getEvents,
    getEventAttendances,
    getPeople,
    getPerson,
    idForItem,
    personFromPeople,
    phoneForPerson,
};

module.exports = ANApi;
