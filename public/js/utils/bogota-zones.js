(function () {
    'use strict';

    const BOGOTA_ZONE_BY_LOCALIDAD = {
        USAQUEN: '01',
        CHAPINERO: '02',
        'SANTA FE': '03',
        'SAN CRISTOBAL': '04',
        USME: '05',
        TUNJUELITO: '06',
        BOSA: '07',
        KENNEDY: '08',
        FONTIBON: '09',
        ENGATIVA: '10',
        SUBA: '11',
        'BARRIOS UNIDOS': '12',
        TEUSAQUILLO: '13',
        'LOS MARTIRES': '14',
        'ANTONIO NARINO': '15',
        'PUENTE ARANDA': '16',
        'LA CANDELARIA': '17',
        'RAFAEL URIBE URIBE': '18',
        'CIUDAD BOLIVAR': '19',
        SUMAPAZ: '20'
    };

    function normalizeZoneText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function getBogotaZoneCode(localidad) {
        const key = normalizeZoneText(localidad);
        if (!key) return null;
        return BOGOTA_ZONE_BY_LOCALIDAD[key] || null;
    }

    function getBogotaZoneLabel(localidad) {
        const code = getBogotaZoneCode(localidad);
        return code ? `Zona ${code}` : null;
    }

    function buildE14NavigationHint(registration = {}) {
        const localidad = registration.localidad || '';
        const puesto = registration.puesto || registration.votingPlace || '';
        const mesa = registration.mesa ?? registration.votingTable ?? null;
        const zoneCode = registration.e14ZoneCode || getBogotaZoneCode(localidad);
        const zoneLabel = zoneCode ? `Zona ${zoneCode}` : 'Zona sin mapear';
        return {
            corporation: 'CAMARA',
            municipality: 'BOGOTA',
            zoneCode,
            zoneLabel,
            locality: localidad,
            pollingPlace: puesto,
            table: mesa,
            candidateCode: '105',
            copyText: `CAMARA | BOGOTA | ${zoneLabel} | ${puesto || '-'} | Mesa ${mesa ?? '-'} | Candidata 105`
        };
    }

    window.BogotaZoneUtils = {
        getBogotaZoneCode,
        getBogotaZoneLabel,
        buildE14NavigationHint
    };
})();
