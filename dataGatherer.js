const fs = require('fs');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2),{
    string: ['station'],
    boolean: ['f'],
    alias: {
        f: 'fetch'
    }
});

const stations = require('./stations.js');
const {HttpsProxyAgent} = require('https-proxy-agent');
const proxy = require('./proxy.js');
const proxyAgent = new HttpsProxyAgent("http://" + proxy);

const bioSearchQuery = `https://naiades.eaufrance.fr/naiades/hydrobiologie/_searchResultats?fieldOrderBy=dateAnalyse&orderByAsc=true&page=1&pageSize=1000`
const chemistrySearchQuery = `https://naiades.eaufrance.fr/naiades/physicochimie/_searchResultats?fieldOrderBy=dateAnalyse&orderByAsc=true&page=1&pageSize=1000`

function buildRequest(station, pageNumber, type) {
    let url = type === 'biology' ? bioSearchQuery : chemistrySearchQuery
    url = url.replace('page=1', 'page=' + pageNumber)
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7",
        "content-type": "application/json;charset=UTF-8",
        "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": "BIGipServerpool_NAIADES_Diffusion_Portail_https=1108060352.47873.0000; TS01396e0a=01ce77d600eedc3ee0f1a1665a88a7ada2626d13fb49f84c6109576f4d82b64239907a146f9f0a925d54a6ebdca2c5494adf2e4eb6a783b36f767f12e2f45532c21d811737",
        "Referer": "https://naiades.eaufrance.fr/acces-donnees",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }
    body = {
        "filters": [{
            "typeEntite": "STATION",
            "id": 10434874,
            "code": station.codeStation,
            "libelle": toString(station.libelleStation)
        }],
        "ignoreFilters": [],
        "currentFilter": {},
        "wkt": "",
        "uri": null,
        "dateDebut": "07/12/2007",
        "dateFin": "07/12/2024",
        "date": null,
        "count": 10,
        "annee": null,
        "emailToSendExport": null,
        "dateOnly": false
    }
    if (type === 'biology') {
        body.filters.push({
            "typeEntite": "SUPPORT_TAX",
            "id": 33424,
            "code": "10",
            "libelle": "Diatomées benthiques"
        })
    }
    method = "POST"
    return {
        url,
        headers,
        body,
        method
    }
}



function convertDate(dateInMs) {
    const date = new Date(parseInt(dateInMs));
    return date
}


let fails = []
let success = []

async function getStationData(station, type) {
    let pageNumber = 1
    let data = []
    let json
    let supportRejectedCount = 0
    let lastRequestTime = new Date()
    let globalStartTime = new Date()
    async function makeRequest(station, pageNumber, type) {
        let timeSinceLastRequest = new Date().getTime() - lastRequestTime.getTime()
        process.stdout.write(chalk.blue(`Fetching ${type} data for station ${station.codeStation}-${station.libelleStation} page ${pageNumber} RT:${(timeSinceLastRequest/1000).toFixed(2)}s GT:${((new Date().getTime() - globalStartTime.getTime())/1000/60).toFixed(2)}min                                       \r`));
        lastRequestTime = new Date()
        let requestData = buildRequest(station, pageNumber, type)
        try {
            let result = await fetch(requestData.url, {
                method: requestData.method,
                headers: requestData.headers,
                body: JSON.stringify(requestData.body),
            })

            json = await result.json()
            for (let item of json.listItems) {
                let chunk = {
                    station: station.codeStation,
                    date: convertDate(item.dateAnalyse),
                }

                if (type == "biology") {
                    chunk.taxon = {
                        code: item.codeAppelationTaxon,
                        libelle: item.libelleAppelationTaxon
                    }
                    chunk.resultat = {
                        value: item.resultat,
                        method: item.libelleMesureTaxon
                    }
                } else {
                    if(item.supportLibelle != "Eau"){
                        supportRejectedCount++
                        //console.log(chalk.red(`(${supportRejectedCount}) Skipping non-water data for station ${station.codeStation}-${station.libelleStation} page ${pageNumber} || Support: ${item.supportLibelle}`));
                        continue
                    }
                    chunk.parametre = {
                        code: item.parametreAnalyseCode,
                        libelle: item.parametreAnalyseNom,
                        support: item.supportLibelle,
                        fraction: item.fractionLibelle
                    }
                    chunk.resultat = {
                        value: parseFloat(item.resultat),
                        unite: item.uniteDeMesureSymbole
                    }
                }
                data.push(chunk)
            }
        } catch (e) {
            console.log(chalk.red(`Error fetching data for station ${station.codeStation}-${station.libelleStation} page ${pageNumber}`));
            console.log(e)
            fails.push(station.codeStation)
            let errorString = `
            Error fetching data for station ${station.codeStation}-${station.libelleStation} page ${pageNumber}
            ${e}

            method: ${requestData.method}
            url: ${requestData.url}
            headers: ${JSON.stringify(requestData.headers)}
            body: ${JSON.stringify(requestData.body)}

            timestamp: ${new Date().toISOString()}
            `
            fs.writeFileSync(`./data/fail-${station.codeStation}-${Math.random()}.txt`, errorString, 'utf8');
            return
        }
        process.stdout.write(chalk.blue(`Got ${json.listItems.length} items                                                                 \r`));
        if (json.listItems.length < 1000) {
            return
        } else {
            pageNumber++
            await makeRequest(station, pageNumber, type)
        }
    }

    await makeRequest(station, pageNumber, type)

    success.push(station.codeStation)
    process.stdout.write(chalk.green(`Successfully fetched ${type} data for station ${station.codeStation}-${station.libelleStation} || items: ${data.length}                              \r`));
    return data
}

async function main() {
    let bioData, chemistryData

    let station = stations[argv.station]
    if(station == undefined){
        console.log(chalk.red(`Station ${argv.station} not found`));
        return
    }
    
    //console.log(chalk.blue(`Fetching data for station ${station.codeStation}-${station.libelleStation}`));

    if(argv.f){
       // console.log(chalk.blue("Fetching data"));
        bioData = await getStationData(station, 'biology')
        chemistryData = await getStationData(station, 'chemistry')
        fs.writeFileSync('./temp.json', JSON.stringify(bioData), 'utf8');
        fs.writeFileSync('./temp2.json', JSON.stringify(chemistryData), 'utf8');
    }else{
        console.log(chalk.blue("Using cached data"));
        bioData = JSON.parse(fs.readFileSync('./temp.json', 'utf8'));
        chemistryData = JSON.parse(fs.readFileSync('./temp2.json', 'utf8'));
    }
    //Building data points
    let mainData = {};
    let dateIndex = {};
    for (let bioEntry of bioData) {
        let date = typeof bioEntry.date === 'string' ? new Date(bioEntry.date) : bioEntry.date
        if (mainData[date] == undefined) {
            mainData[date] = {}
        }

        if (mainData[date][bioEntry.taxon.code] == undefined) {
            mainData[date][bioEntry.taxon.code] = {
                taxon: bioEntry.taxon,
                resultat: bioEntry.resultat,
            }
        }
    }

    let c = 0
    let i = 0
    for (let chemEntry of chemistryData) {
        i++
        let date = typeof chemEntry.date === 'string' ? new Date(chemEntry.date) : chemEntry.date
        if (mainData[date] == undefined) {

            if (dateIndex[date] != undefined) {
                date = dateIndex[date]
            } else {
                if(Object.keys(mainData).length === 0){
                    process.stdout.write(chalk.red(`Skipping chemistry data for date ${date} due to missing biology data                             \r`));
                    continue
                }
                let closestDate = Object.keys(mainData).reduce((a, b) => {
                    a = typeof a === 'string' ? new Date(a) : a
                    b = typeof b === 'string' ? new Date(b) : b
                    return Math.abs(b.getTime() - date.getTime()) < Math.abs(a.getTime() - date.getTime()) ? b : a
                })
                if(typeof closestDate === 'string'){
                    closestDate = new Date(closestDate)
                }
                let gap = Math.abs(closestDate.getTime() - date.getTime()) / 1000 / 60 / 60 / 24

                //process.stdout.write(gap > 15 ? chalk.red(`(${Object.keys(dateIndex).length}) Gap of ${gap} days between chemistry and biology data for ${date}                                                                 \r`) : chalk.green(`Gap of ${gap} days between chemistry and biology data for ${date}                                                                 \r`));
                if (gap < 15) {
                    dateIndex[date] = closestDate
                    date = closestDate
                }
            }
        }else{
            dateIndex[date] = date
        }

        if (mainData[date] == undefined) {
            
            continue
        }
        process.stdout.write(chalk.green(`Data for date ${date} (${c}/${i})                                                                     \r`));     
        c++
        if (mainData[date][chemEntry.parametre.code] == undefined) {
            mainData[date][chemEntry.parametre.code] = {
                parametre: chemEntry.parametre,
                resultat: chemEntry.resultat,
            }
        }
    }

    for (let date in mainData) {
        let taxons = Object.values(mainData[date]).filter(key => key.taxon != undefined)
        let params = Object.values(mainData[date]).filter(key => key.parametre != undefined)
        if (taxons.length === 0 || params.length === 0) {
            console.log(chalk.red(`Deleting date ${date} due to missing data`));
            delete mainData[date]
        }
    }

    fs.writeFileSync(`./dataPoints/dataPoints-${station.codeStation}.json`, JSON.stringify(mainData), 'utf8');
}

main()