/**
 * The MIT License (MIT)
 *
 * Igor Zinken 2016 - http://www.igorski.nl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
"use strict";

const Config   = require( "../config/Config" );
const Copy     = require( "../i18n/Copy" );
const Messages = require( "../definitions/Messages" );
const Style    = require( "zjslib" ).Style;
const Pubsub   = require( "pubsub-js" );
const Bowser   = require( "bowser" );

/* private variables */

let patternContainer, trackList, transportSection, patternEditor, helpSection,
    blind, loader, calculationPending = false, scrollPending = false, loadRequests = 0;

const getStyle = Style.getStyle;
let transportWidth, patternEditorWidth, helpSectionWidth, trackListHeight;

module.exports =
{
    init()
    {
        // create DOM elements

        blind = document.querySelector( "#blind" );

        // add listeners to DOM

        window.addEventListener( "resize", handleEvent );
        window.addEventListener( "scroll", handleEvent );

        // listen to window unload when user navigates away

        if ( !Config.isDevMode() ) {
            if ( Bowser.ios ) {
                window.addEventListener( "popstate", handleUnload );
            }
            else {
                if ( typeof window.onbeforeunload !== "undefined" ) { // unavailable to Chrome apps
                    const prevBeforeUnload = window.onbeforeunload;
                    window.onbeforeunload = ( aEvent ) => {
                        if ( prevBeforeUnload ) {
                            prevBeforeUnload( aEvent );
                        }
                        return handleUnload( aEvent );
                    };
                }
            }
        }

        // subscribe to messaging system

        [
            Messages.SHOW_BLIND,
            Messages.HIDE_BLIND,
            Messages.SHOW_LOADER,
            Messages.HIDE_LOADER,
            Messages.CLOSE_OVERLAYS,
            Messages.PATTERN_STEPS_UPDATED,
            Messages.HELP_SECTION_UPDATED,
            Messages.SONG_LOADED

        ].forEach(( msg ) => Pubsub.subscribe( msg, handleBroadcast ));

        // ensure that on application start all elements are presented correctly

        calculateDimensions();
    }
};

/* private methods */

function handleBroadcast( type, payload )
{
    switch ( type )
    {
        case Messages.SHOW_BLIND:
            document.body.classList.add( "blind" );
            break;

        case Messages.HIDE_BLIND:
        case Messages.CLOSE_OVERLAYS:
            document.body.classList.remove( "blind" );
            break;

        case Messages.SHOW_LOADER:

            if ( ++loadRequests === 1 && !loader ) {
                Pubsub.publish( Messages.SHOW_BLIND );
                efflux.TemplateService.renderAsElement( "loader" ).then(( template ) => {
                    loader = template;
                    document.body.appendChild( loader );
                });
            }
            break;

        case Messages.HIDE_LOADER:
            loadRequests = Math.max( 0, loadRequests - 1 );

            if ( loadRequests === 0 && loader ) {
                Pubsub.publish( Messages.HIDE_BLIND );
                loader.parentNode.removeChild( loader );
                loader = null;
            }
            break;

        case Messages.PATTERN_STEPS_UPDATED:
        case Messages.HELP_SECTION_UPDATED:

            if ( !calculationPending ) {
                calculationPending = true;
                requestAnimationFrame(() => {
                    calculateDimensions();
                    calculationPending = false;
                });
            }
            break;

        case Messages.SONG_LOADED:
            setTimeout( calculateDimensions, 10 ); // poor mans hack to let the pattern template render first...
            break;
    }
}

function handleEvent( aEvent )
{
    switch ( aEvent.type )
    {
        case "resize":
            Pubsub.publish( Messages.WINDOW_RESIZED );
            calculateDimensions();
            break;

        case "scroll":

            // only fire this event on RAF to avoid
            // DOM thrashing by the subscribed listeners

            if ( !scrollPending ) {
                scrollPending = true;
                requestAnimationFrame(() => {
                    Pubsub.publish( Messages.WINDOW_SCROLLED );
                    scrollPending = false;
                });
            }
            break;
    }
}

function handleUnload( aEvent )
{
    return Copy.get( "WARNING_UNLOAD" );
}

/**
 * due to the nature of the table display of the pattern editors track list
 * we need JavaScript to calculate to correct dimensions of the overflowed track list
 *
 * @param aEvent
 */
function calculateDimensions( aEvent )
{
    // grab references to DOM elements (we do this lazily)

    patternContainer = patternContainer || document.querySelector( "#patternContainer" );
    transportSection = transportSection || document.querySelector( "#transportSection" );
    patternEditor    = patternEditor    || document.querySelector( "#patternEditor" );
    trackList        = trackList        || document.querySelector( "#patternTrackList" );
    helpSection      = helpSection      || document.querySelector( "#helpSection" );

    // avoid thrashing by reading styles first

    transportWidth     = getStyle( transportSection, "width" );
    patternEditorWidth = getStyle( patternEditor,    "width" );
    helpSectionWidth   = getStyle( helpSection,      "width" );

    const targetWidth = (

        parseFloat( transportWidth ) -
        parseFloat( patternEditorWidth ) -
        parseFloat( helpSectionWidth )

    ) + "px";

    trackList.style.width        = targetWidth;
    patternContainer.style.width = targetWidth;

    // side containers should be as tall as the pattern container (help container is scrollable)

    requestAnimationFrame(() => {

        // TODO : can we not do this at all with proper flexbox usage ?

        trackList.style.height = "auto"; // force Flexbox calculation
        helpSection.style.maxHeight = getStyle( trackList, "height" );
    });
}
