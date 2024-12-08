const proxyList = [
    "20.111.54.16:8123",
    "51.255.20.138:80",
    "87.98.148.98:80",
    "51.254.78.223:80",
    "195.35.2.231:80"

]

module.exports = proxyList[Math.floor(Math.random() * proxyList.length)]