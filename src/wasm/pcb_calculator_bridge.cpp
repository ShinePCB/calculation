/*
 * Browser bridge for the non-transmission-line pages of KiCad PCB Calculator.
 * Formulae are ported from pcb_calculator at KiCad commit 99c64afb.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
#include <cmath>
#include <emscripten/emscripten.h>
#include <pcb_calculator/calculator_panels/iec60664.h>

namespace { constexpr double MIL = 0.0000254; constexpr double C0 = 299792458.0; }

extern "C" {
EMSCRIPTEN_KEEPALIVE int pcbcalc_abi_version() { return 1; }

EMSCRIPTEN_KEEPALIVE double pcbcalc_iec60664(int out, double rated, double rms,
 double peak, double transient, double altitude, double frequency, int pollution,
 int overvoltage, int material, int insulation, int field, int pcb)
{
    IEC60664 calc;
    calc.SetRatedVoltage(rated); calc.SetRMSVoltage(rms); calc.SetPeakVoltage(peak);
    calc.SetTransientVoltage(transient); calc.SetAltitude(altitude); calc.SetFrequency(frequency);
    calc.SetPollutionDegree(static_cast<IEC60664::POLLUTION_DEGREE>(pollution));
    calc.SetOvervoltageCategory(static_cast<IEC60664::OV_CATEGORY>(overvoltage));
    calc.SetMaterialGroup(static_cast<IEC60664::MATERIAL_GROUP>(material));
    calc.SetInsulationType(static_cast<IEC60664::INSULATION_TYPE>(insulation));
    calc.SetField(static_cast<IEC60664::FIELD>(field)); calc.SetPCBMaterial(pcb != 0);
    if(!calc.Compute()) return NAN;
    const double values[]={calc.GetClearanceDistance(),calc.GetCreepageDistance(),calc.GetMinGrooveWidth(),calc.GetRatedImpulseWithstandVoltage()};
    return out>=0&&out<4?values[out]:NAN;
}

// PANEL_VIA_SIZE::OnViaCalculate. Inputs are SI; output indices follow the UI order.
EMSCRIPTEN_KEEPALIVE double pcbcalc_via(int out, double hole, double plating, double length,
 double pad, double clearance, double z0, double current, double rho, double er,
 double deltaT, double riseTime)
{
    const double area = M_PI * (hole + plating) * plating;
    if(area <= 0 || clearance == pad || riseTime <= 0) return NAN;
    const double resistance = rho * length / area;
    const double voltage = current * resistance;
    const double power = current * voltage;
    const double thermal = 2.49e-3 * length / area;
    const double areaMil = area / (MIL * MIL);
    const double ampacity = 0.048 * std::pow(deltaT, .44) * std::pow(areaMil, .725);
    const double capacitance = 55.51 * er * length * pad / (clearance - pad);
    const double degradation = 2.2 * capacitance * z0 / 2.0;
    const double inductance = 200.0 * length * (std::log(4.0 * length / hole) + 1.0);
    const double reactance = M_PI * inductance / riseTime;
    const double values[] = {resistance, voltage, power, ampacity, thermal, capacitance,
                             degradation, inductance, reactance};
    return out >= 0 && out < 9 ? values[out] : NAN;
}

// IPC-2221 track-width equations used by PANEL_TRACK_WIDTH.
EMSCRIPTEN_KEEPALIVE double pcbcalc_track_width(double current, double thickness,
 double deltaT, int internal)
{
    const double k = internal ? .024 : .048;
    const double tMil = thickness / MIL;
    return std::exp((std::log(current)-std::log(k)-.44*std::log(deltaT)-.725*std::log(tMil))/.725)*MIL;
}
EMSCRIPTEN_KEEPALIVE double pcbcalc_track_current(double width, double thickness,
 double deltaT, int internal)
{
    const double area = width / MIL * thickness / MIL;
    return (internal ? .024 : .048) * std::pow(deltaT,.44) * std::pow(area,.725);
}
EMSCRIPTEN_KEEPALIVE double pcbcalc_track_aux(int out, double current, double width,
 double thickness, double length, double rho)
{
    const double resistance = rho * length / (width * thickness);
    const double voltage = resistance * current;
    const double values[] = {resistance, voltage, voltage * current};
    return out >= 0 && out < 3 ? values[out] : NAN;
}

// PANEL_FUSING_CURRENT::m_onCalculateClick. mode: 0 width, 1 thickness, 2 current, 3 time.
EMSCRIPTEN_KEEPALIVE double pcbcalc_fusing(int mode, double ambientC, double meltingC,
 double width, double thickness, double current, double time)
{
    if(meltingC <= ambientC || ambientC <= -273.15) return NAN;
    const double energy = 8940.0 * ((meltingC-ambientC)*385.0 + 205350.0);
    const double ra = ((ambientC + 273.15 - 293.0)*.00393 + 1.0)*1.72e-8;
    const double rm = ((meltingC + 273.15 - 293.0)*.00393 + 1.0)*1.72e-8;
    const double coeff = energy / ((rm+ra)/2.0);
    const double area = width * thickness;
    if(mode == 0) return current / std::sqrt(coeff/time) / thickness;
    if(mode == 1) return current / std::sqrt(coeff/time) / width;
    if(mode == 2) return area * std::sqrt(coeff/time);
    if(mode == 3) return coeff * area * area / (current*current);
    return NAN;
}

// PANEL_WAVELENGTH::update. Outputs: period, vacuum wavelength, medium wavelength, speed.
EMSCRIPTEN_KEEPALIVE double pcbcalc_wavelength(int out, double frequency, double er, double mur)
{
    const double speed = C0/std::sqrt(er*mur);
    const double values[] = {1.0/frequency, C0/frequency, speed/frequency, speed};
    return out >= 0 && out < 4 ? values[out] : NAN;
}

// attenuator_classes.cpp. topology: 0 Pi, 1 Tee, 2 bridged Tee, 3 splitter.
EMSCRIPTEN_KEEPALIVE double pcbcalc_attenuator(int topology, int out, double zin,
 double zout, double attenuation)
{
    if(topology == 3) return out < 3 ? zout/3.0 : 6.0;
    if(topology == 2) zin = zout;
    const double L = std::pow(10.0, attenuation/10.0);
    const double A = (L+1.0)/(L-1.0);
    const double ratio = zin > zout ? zin/zout : zout/zin;
    const double lmin = 2.0*ratio-1.0+2.0*std::sqrt(ratio*(ratio-1.0));
    const double minAtt = 10.0*std::log10(lmin);
    if(out == 3) return minAtt;
    if(minAtt > attenuation) return NAN;
    double r1=0,r2=0,r3=0;
    if(topology == 0) { r2=(L-1.0)/2.0*std::sqrt(zin*zout/L); r1=1.0/(A/zin-1.0/r2); r3=1.0/(A/zout-1.0/r2); }
    else if(topology == 1) { r2=2.0*std::sqrt(L*zin*zout)/(L-1.0); r1=zin*A-r2; r3=zout*A-r2; }
    else if(topology == 2) { const double l=std::pow(10.0,attenuation/20.0); r1=zin*(l-1.0); r2=zin/(l-1.0); r3=0; }
    const double values[] = {r1,r2,r3}; return out >= 0 && out < 3 ? values[out] : NAN;
}

// PANEL_CABLE_SIZE core relationships at conductor temperature.
EMSCRIPTEN_KEEPALIVE double pcbcalc_cable(int out, double diameter, double rho20,
 double alpha, double tempC, double currentDensity, double frequency, double length,
 double current)
{
    const double area=M_PI*diameter*diameter/4.0;
    const double rho=rho20*(1.0+alpha*(tempC-20.0));
    const double linear=rho/area;
    const double resistance=linear*length;
    const double voltage=resistance*current;
    const double values[]={area,linear,area*currentDensity,frequency>0?std::sqrt(rho/(M_PI*frequency*4e-7*M_PI)):INFINITY,resistance,voltage,voltage*current};
    return out>=0 && out<7?values[out]:NAN;
}
}
