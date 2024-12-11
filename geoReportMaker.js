const fs = require('fs');
let chalk = require('chalk');
chalk = chalk.default;
const argv = require('minimist')(process.argv.slice(2), {
    string: ['station'],
    boolean: ['f'],
    alias: {
        f: 'fetch'
    }
});

const stations = require('./stations.js');
chalk.red(`Got ${Object.keys(stations).length} stations`);
let points = []

function createKML(points) {
    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
    `;

    const kmlFooter = `</Document>
    </kml>`;
    
   
    const kmlPoints = points.map(point => `
        <Placemark>
            <name></name>
            
            ${point.extendedData}
            <Point>
                <coordinates>${point.coordinates.lng},${point.coordinates.lat},0</coordinates>
            </Point>
            <Style>
                <IconStyle>
                    <Icon>
                        <href>${point.icon}</href>
                    </Icon>
                </IconStyle>
            </Style>
        </Placemark>
    `).join('');

    return `${kmlHeader}${kmlPoints}${kmlFooter}`;
}

function getIcon(n){
    if(n < 6){
        return "https://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png"
    }

    if(n < 8){
        return "https://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png"
    }

    return "https://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png"
}

for (let station of Object.values(stations)) {
    if (fs.existsSync(`./reports/report-${station.codeStation}.json`) == false) {
        continue
    }
    let report = JSON.parse(fs.readFileSync(`./reports/report-${station.codeStation}.json`, 'utf8'))
    let dataPoints = JSON.parse(fs.readFileSync(`./dataPoints/dataPoints-${station.codeStation}.json`, 'utf8'))
    //console.log(chalk.blue(`Got ${Object.keys(dataPoints).length} data points for station ${station.codeStation}-${station.libelleStation}`));

    let topCorrelations = ``
    if(report.topCorrelations["Amphora pediculus"] != undefined){
        topCorrelations = `<Data name="Top correlations"><value>${Object.keys(report.topCorrelations["Amphora pediculus"]).length}</value></Data>`
    }else{
        topCorrelations = `<Data name="Top correlations"><value>0</value></Data>`
    }
    let point = {
        label: station.libelleStation,
        coordinates: {
            lat: station.coordY,
            lng: station.coordX
        },
        icon: getIcon(Object.keys(dataPoints).length),
        extendedData: `
            <ExtendedData>
                <Data name="Code Station"><value>${station.codeStation}</value></Data>
                <Data name="Nom Station"><value>${station.libelleStation}</value></Data>
                <Data name="Points de données"><value>${Object.keys(dataPoints).length}</value></Data>
                ${topCorrelations}
            </ExtendedData>
        `
    }
    points.push(point)

}

fs.writeFileSync(`./data/stations-${Math.random()}.kml`, createKML(points));