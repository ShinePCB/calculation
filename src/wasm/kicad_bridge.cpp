/*
 * LayerLine WebAssembly bridge for KiCad transmission-line calculations.
 * Copyright (C) 2026 LayerLine contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

#include <cstdint>
#include <exception>
#include <memory>
#include <string>

#include <emscripten/emscripten.h>

#include <transline_calculations/coax.h>
#include <transline_calculations/coplanar.h>
#include <transline_calculations/coupled_microstrip.h>
#include <transline_calculations/coupled_stripline.h>
#include <transline_calculations/microstrip.h>
#include <transline_calculations/rectwaveguide.h>
#include <transline_calculations/stripline.h>
#include <transline_calculations/twistedpair.h>

namespace
{
thread_local int g_lastError = 0;
thread_local std::string g_text;

TRANSLINE_CALCULATION_BASE* fromHandle( std::uintptr_t aHandle )
{
    return reinterpret_cast<TRANSLINE_CALCULATION_BASE*>( aHandle );
}

std::unique_ptr<TRANSLINE_CALCULATION_BASE> createModel( int aModel )
{
    switch( aModel )
    {
    case 0: return std::make_unique<MICROSTRIP>();
    case 1: return std::make_unique<COUPLED_MICROSTRIP>();
    case 2: return std::make_unique<STRIPLINE>();
    case 3: return std::make_unique<COUPLED_STRIPLINE>();
    case 4: return std::make_unique<COPLANAR>();
    case 5: return std::make_unique<COAX>();
    case 6: return std::make_unique<RECTWAVEGUIDE>();
    case 7: return std::make_unique<TWISTEDPAIR>();
    default: return {};
    }
}
}

extern "C"
{
EMSCRIPTEN_KEEPALIVE int tl_abi_version()
{
    return 1;
}

EMSCRIPTEN_KEEPALIVE std::uintptr_t tl_create( int aModel )
{
    g_lastError = 0;
    auto model = createModel( aModel );

    if( !model )
    {
        g_lastError = 1;
        return 0;
    }

    return reinterpret_cast<std::uintptr_t>( model.release() );
}

EMSCRIPTEN_KEEPALIVE void tl_destroy( std::uintptr_t aHandle )
{
    delete fromHandle( aHandle );
}

EMSCRIPTEN_KEEPALIVE int tl_has_parameter( std::uintptr_t aHandle, int aParameter )
{
    g_lastError = 0;

    try
    {
        (void) fromHandle( aHandle )->GetParameter( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
        return 1;
    }
    catch( const std::exception& )
    {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE int tl_set_parameter( std::uintptr_t aHandle, int aParameter, double aValue )
{
    g_lastError = 0;

    try
    {
        fromHandle( aHandle )->SetParameter( static_cast<TRANSLINE_PARAMETERS>( aParameter ), aValue );
        return 1;
    }
    catch( const std::exception& )
    {
        g_lastError = 2;
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE double tl_get_parameter( std::uintptr_t aHandle, int aParameter )
{
    g_lastError = 0;

    try
    {
        return fromHandle( aHandle )->GetParameter( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
    }
    catch( const std::exception& )
    {
        g_lastError = 2;
        return 0.0 / 0.0;
    }
}

EMSCRIPTEN_KEEPALIVE int tl_analyse( std::uintptr_t aHandle )
{
    g_lastError = 0;

    try
    {
        fromHandle( aHandle )->Analyse();
        return 1;
    }
    catch( const std::exception& )
    {
        g_lastError = 3;
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE int tl_synthesize( std::uintptr_t aHandle, int aOption, int aTarget )
{
    g_lastError = 0;

    try
    {
        auto* model = fromHandle( aHandle );
        model->SetSynthesizeTarget( static_cast<TRANSLINE_PARAMETERS>( aTarget ) );
        return model->Synthesize( static_cast<SYNTHESIZE_OPTS>( aOption ) ) ? 1 : 0;
    }
    catch( const std::exception& )
    {
        g_lastError = 4;
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE int tl_get_analysis_status( std::uintptr_t aHandle, int aParameter )
{
    try
    {
        auto& results = fromHandle( aHandle )->GetAnalysisResults();
        const auto it = results.find( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
        return it == results.end() ? -1 : static_cast<int>( it->second.second );
    }
    catch( const std::exception& )
    {
        return -1;
    }
}

EMSCRIPTEN_KEEPALIVE int tl_get_synthesis_status( std::uintptr_t aHandle, int aParameter )
{
    try
    {
        auto& results = fromHandle( aHandle )->GetSynthesisResults();
        const auto it = results.find( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
        return it == results.end() ? -1 : static_cast<int>( it->second.second );
    }
    catch( const std::exception& )
    {
        return -1;
    }
}

// Many outputs (coupled-line εeff / delays / losses, Zdiff, stripline delay, ...) exist only in the
// result maps that the KiCad UI reads, not in the parameter map, so expose their values too.
EMSCRIPTEN_KEEPALIVE double tl_get_analysis_value( std::uintptr_t aHandle, int aParameter )
{
    try
    {
        auto& results = fromHandle( aHandle )->GetAnalysisResults();
        const auto it = results.find( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
        return it == results.end() ? 0.0 / 0.0 : it->second.first;
    }
    catch( const std::exception& )
    {
        return 0.0 / 0.0;
    }
}

EMSCRIPTEN_KEEPALIVE double tl_get_synthesis_value( std::uintptr_t aHandle, int aParameter )
{
    try
    {
        auto& results = fromHandle( aHandle )->GetSynthesisResults();
        const auto it = results.find( static_cast<TRANSLINE_PARAMETERS>( aParameter ) );
        return it == results.end() ? 0.0 / 0.0 : it->second.first;
    }
    catch( const std::exception& )
    {
        return 0.0 / 0.0;
    }
}

// Propagating TE / TM modes (COAX and RECTWAVEGUIDE only), as shown by the KiCad UI.
// aWhich: 0 = TE, 1 = TM.  Returns a NUL-terminated string valid until the next call.
EMSCRIPTEN_KEEPALIVE const char* tl_get_modes( std::uintptr_t aHandle, int aWhich )
{
    g_text.clear();
    auto* model = fromHandle( aHandle );

    if( auto* coax = dynamic_cast<COAX*>( model ) )
        g_text = aWhich ? coax->GetTMModes() : coax->GetTEModes();
    else if( auto* wg = dynamic_cast<RECTWAVEGUIDE*>( model ) )
        g_text = aWhich ? wg->GetTMModes() : wg->GetTEModes();

    return g_text.c_str();
}

EMSCRIPTEN_KEEPALIVE int tl_last_error()
{
    return g_lastError;
}
}
