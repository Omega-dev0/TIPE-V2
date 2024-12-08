const fs = require('fs')

function getStations() {
    let comboStations = {}
    for (let bioStation of bioStations) {
        if (chemistryStations.find(chemStation => chemStation.codeStation === bioStation.codeStation)) {
            comboStations[bioStation.codeStation] = bioStation
        }
    }
    return comboStations
}

bioStations = JSON.parse(fs.readFileSync('./data/stationsBio.json', 'utf8'))


chemistryStations = JSON.parse(fs.readFileSync('./data/stationsChimie.json', 'utf8'))

module.exports = getStations()

