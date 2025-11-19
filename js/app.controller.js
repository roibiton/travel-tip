import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onSaveLoc,
    onCloseModal,
    onChangeColorTheme,
    saveColorTheme

}
var gUserPos
var gGeoData
var gBgColors

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    setInputColors()
    mapService.initMap()
        .then(() => {
            mapService.addClickListener(geo => {
                onAddLoc(geo)
            })
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            loadAndRenderLocs()
        })
        .catch(err => {
            console.log('User position not available:', err)
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
                <h5>${(gUserPos?.lat === loc.geo.lat && gUserPos?.lng === loc.geo.lng) ? ' (You)' : (gUserPos ? utilService.getDistance(gUserPos, loc.geo, 'km') + ' km' : '')}</h5>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        if (selectedLoc) {
            displayLoc(selectedLoc)
        }
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    if (!confirm('Are you sure?')) return
    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    const elModal = document.querySelector('.loc-modal')
    const elForm = elModal.querySelector('.loc-form')
    const elTitle = elModal.querySelector('.modal-title')
    elForm.reset()
    elTitle.innerText = 'Add Location'
    const elNameInput = elForm.querySelector('[name="name"]')
    elNameInput.value = geo.address || 'Just a place'
    gGeoData = geo
    delete elModal.dataset.locId
    elModal.showModal()
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            const elModal = document.querySelector('.loc-modal')
            const elForm = elModal.querySelector('.loc-form')
            const elTitle = elModal.querySelector('.modal-title')
            elTitle.innerText = 'Update Location'
            elForm.querySelector('[name="name"]').value = loc.name
            elForm.querySelector('[name="rate"]').value = loc.rate
            elModal.dataset.locId = loc.id
            gGeoData = loc.geo
            elModal.showModal()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load location for editing')
        })
}

function onSaveLoc(ev) {
    ev.preventDefault()
    const elModal = document.querySelector('.loc-modal')
    const elForm = elModal.querySelector('.loc-form')
    const formData = new FormData(elForm)
    const name = formData.get('name')
    const rate = +formData.get('rate')
    const geo = gGeoData
    const locId = elModal.dataset.locId
    const loc = {
        name,
        rate,
        geo
    }
    if (locId) {
        loc.id = locId
    }
    locService.save(loc)
        .then((savedLoc) => {
            const action = locId ? 'updated' : 'added'
            flashMsg(`Location ${action} successfully`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
            elModal.close()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot save location')
        })
}

function onCloseModal(selector) {
    const elModal = document.querySelector(`.${selector}`)
    elModal.close()
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')
    mapService.panTo(loc.geo)
    mapService.setMarker(loc)
    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')
    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999)
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({txt, minRate})
    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked
    if (!prop) return
    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1
    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdate().then(stats => {
        handleStats(stats, 'loc-stats-update')
    })

}

function handleStats(stats, selector) {
    const labels = cleanStats(stats)
    const colors = utilService.getColors()
    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })
    colorsStr += `${colors[labels.length - 1]} ${100}%`
    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style
    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')
    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function onChangeColorTheme() {

    const elModal = document.querySelector('.color-modal')
    elModal.showModal()
}

function saveColorTheme(ev) {
    const elModal = document.querySelector('.color-modal')
    ev.preventDefault()
    const root = document.documentElement
    const color1 = document.querySelector('[name="color1"]').value
    const color2 = document.querySelector('[name="color2"]').value
    const color3 = document.querySelector('[name="color3"]').value

    root.style.setProperty('--bg1', color1)
    root.style.setProperty('--bg2', color2)
    root.style.setProperty('--bg3', color3)

    gBgColors = {
        color1,
        color2,
        color3
    }
    setInputColors()    
    elModal.close()
}

function setInputColors(){
    const colorInp1 = document.querySelector('[name="color1"]')
    const colorInp2 = document.querySelector('[name="color2"]')
    const colorInp3 = document.querySelector('[name="color3"]')

    if (!gBgColors){
        console.log('hi');
        
        const root = document.documentElement
        const rootStyles = getComputedStyle(root)
        const color1 = rootStyles.getPropertyValue('--bg1').trim()
        const color2 = rootStyles.getPropertyValue('--bg2').trim()
        const color3 = rootStyles.getPropertyValue('--bg3').trim()
        console.log(color1, color2, color3);
        
        colorInp1.value = color1
        colorInp2.value = color2
        colorInp3.value = color3

    }else{
        colorInp1.value = gBgColors.color1
        colorInp2.value = gBgColors.color2
        colorInp3.value = gBgColors.color3
    }
}