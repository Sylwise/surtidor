import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enlaceAppleMaps, enlaceGeo, enlaceGoogleMaps, enlacePrincipal, enlaceWaze, esAndroid } from './llegar.ts';

describe('esAndroid', () => {
  it('reconoce un user agent de Android', () => {
    assert.equal(esAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), true);
  });

  it('no confunde iOS ni escritorio con Android', () => {
    assert.equal(esAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
    assert.equal(esAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  });
});

describe('enlaces de mapas', () => {
  it('Google Maps: enlace universal con destino', () => {
    assert.equal(
      enlaceGoogleMaps(42.8695, -2.6716),
      'https://www.google.com/maps/dir/?api=1&destination=42.8695,-2.6716',
    );
  });

  it('geo: lleva el punto en la etiqueta, con el rótulo escapado', () => {
    assert.equal(enlaceGeo(42.8695, -2.6716, 'BALLENOIL, S/L'), 'geo:0,0?q=42.8695,-2.6716(BALLENOIL%2C%20S%2FL)');
  });

  it('Waze: ll + navigate=yes', () => {
    assert.equal(enlaceWaze(42.8695, -2.6716), 'https://waze.com/ul?ll=42.8695,-2.6716&navigate=yes');
  });

  it('Apple Maps: daddr', () => {
    assert.equal(enlaceAppleMaps(42.8695, -2.6716), 'https://maps.apple.com/?daddr=42.8695,-2.6716');
  });

  it('enlace principal: geo: en Android, Google Maps en cualquier otro caso', () => {
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';
    const escritorio = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    assert.equal(enlacePrincipal(42.8695, -2.6716, 'BALLENOIL', android), enlaceGeo(42.8695, -2.6716, 'BALLENOIL'));
    assert.equal(enlacePrincipal(42.8695, -2.6716, 'BALLENOIL', escritorio), enlaceGoogleMaps(42.8695, -2.6716));
  });
});
