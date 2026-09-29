# KiCad PCB Calculator WebAssembly port

This project includes source files from KiCad's `common/transline_calculations`
and `pcb_calculator` directories at commit
`99c64afbf83fbca8b97093a0e966e00e28915dca`, plus WebAssembly C API bridges
and a browser interface.

KiCad is copyright its respective contributors. The included KiCad sources
and this combined work are distributed under the GNU General Public License,
version 3 or (where an upstream file permits it) any later version.

Upstream source: https://gitlab.com/kicad/code/kicad

The browser UI does not include a material preset database. Inputs map to
KiCad transmission-line parameters and use SI units internally.

The transmission-line cross-section pictures in `dist/img/kicad/` are KiCad's
own bitmaps (`microstrip`, `c_microstrip`, `stripline`, `coupled_stripline`,
`cpw`, `cpw_back`, `rectwaveguide`, `coax`, `twistedpair`,
`microstrip_zodd_zeven`, light and dark variants), taken unmodified from the
KiCad 10.0 `resources/images` archive and distributed under GPL-3.0-or-later.
