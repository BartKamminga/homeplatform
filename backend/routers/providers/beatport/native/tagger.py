"""BeatCrades — Native Beatport audio tagger (mutagen).

Ondersteunde formaten: FLAC, MP3, WAV.
Slaat ook cover art in als embedded thumbnail.
"""

import logging
import os
from typing import Optional

from .api import BPTrack

logger = logging.getLogger("homeplatform.beatcrades.beatport.native.tagger")


def tag_track(path: str, track: BPTrack, cover_data: Optional[bytes] = None) -> None:
    """Voeg Beatport-metadata toe aan het audiobestand op `path`."""
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".flac":
            _tag_flac(path, track, cover_data)
        elif ext == ".mp3":
            _tag_mp3(path, track, cover_data)
        elif ext in (".wav", ".wave"):
            _tag_wav(path, track)
        else:
            logger.warning("Onbekend formaat voor tagging: %s", ext)
    except Exception as exc:
        logger.warning("Tagging mislukt voor %s: %s", path, exc)


def _tag_flac(path: str, track: BPTrack, cover_data: Optional[bytes]) -> None:
    from mutagen.flac import FLAC, Picture
    from mutagen.id3 import PictureType

    f = FLAC(path)
    f["title"] = [track.title()]
    f["artist"] = [track.artist_str()]
    if track.number:
        f["tracknumber"] = [str(track.number)]
    if track.disc_number:
        f["discnumber"] = [str(track.disc_number)]
    if track.genre:
        f["genre"] = [track.genre.name]
    if track.bpm:
        f["bpm"] = [str(track.bpm)]
    if track.isrc:
        f["isrc"] = [track.isrc]
    if track.key:
        f["key"] = [track.key.label()]
    if track.release:
        f["album"] = [track.release.name]
        if track.release.new_release_date or track.publish_date:
            f["date"] = [track.release.new_release_date or track.publish_date]
        if track.release.label:
            f["organization"] = [track.release.label.name]
        if track.release.catalog_number:
            f["catalognumber"] = [track.release.catalog_number]

    if cover_data:
        pic = Picture()
        pic.type = PictureType.COVER_FRONT
        pic.mime = "image/jpeg"
        pic.data = cover_data
        f.clear_pictures()
        f.add_picture(pic)

    f.save()


def _tag_mp3(path: str, track: BPTrack, cover_data: Optional[bytes]) -> None:
    from mutagen.id3 import (
        ID3, ID3NoHeaderError,
        TIT2, TPE1, TRCK, TPOS, TCON, TBPM, TSRC, TKEY, TALB, TDRC, TPUB, APIC,
    )

    try:
        tags = ID3(path)
    except ID3NoHeaderError:
        tags = ID3()

    tags["TIT2"] = TIT2(text=[track.title()])
    tags["TPE1"] = TPE1(text=[track.artist_str()])
    if track.number:
        tags["TRCK"] = TRCK(text=[str(track.number)])
    if track.disc_number:
        tags["TPOS"] = TPOS(text=[str(track.disc_number)])
    if track.genre:
        tags["TCON"] = TCON(text=[track.genre.name])
    if track.bpm:
        tags["TBPM"] = TBPM(text=[str(track.bpm)])
    if track.isrc:
        tags["TSRC"] = TSRC(text=[track.isrc])
    if track.key:
        tags["TKEY"] = TKEY(text=[track.key.label()])
    if track.release:
        tags["TALB"] = TALB(text=[track.release.name])
        date_str = track.release.new_release_date or track.publish_date or ""
        if date_str:
            tags["TDRC"] = TDRC(text=[date_str])
        if track.release.label:
            tags["TPUB"] = TPUB(text=[track.release.label.name])

    if cover_data:
        tags["APIC"] = APIC(
            mime="image/jpeg",
            type=3,
            desc="Cover",
            data=cover_data,
        )

    tags.save(path)


def _tag_wav(path: str, track: BPTrack) -> None:
    # WAV ondersteunt via mutagen alleen ID3-tags (beperkt)
    try:
        from mutagen.wave import WAVE
        from mutagen.id3 import TIT2, TPE1, TALB

        f = WAVE(path)
        if f.tags is None:
            f.add_tags()
        f.tags["TIT2"] = TIT2(text=[track.title()])
        f.tags["TPE1"] = TPE1(text=[track.artist_str()])
        if track.release:
            f.tags["TALB"] = TALB(text=[track.release.name])
        f.save()
    except Exception as exc:
        logger.warning("WAV tagging beperkt: %s", exc)
