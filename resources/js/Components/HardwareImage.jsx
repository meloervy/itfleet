import { useEffect, useState } from 'react';
import {
    RiComputerLine,
    RiMacbookLine,
    RiSmartphoneLine,
    RiTv2Line,
    RiKeyboardLine,
} from 'react-icons/ri';

/**
 * Maps known device models/URLs to local static image assets.
 * Guarantees instant 0ms rendering and eliminates external hotlink (403) failures.
 */
function resolveLocalAsset(url, alt = '') {
    if (url && url.startsWith('/images/devices/')) return url;

    const text = `${url || ''} ${alt}`.toLowerCase().trim();
    if (!text) return url || null;

    if (text.includes('macbook_pro') || text.includes('macbook pro') || text.includes('macbook-pro') || text.includes('mac studio') || text.includes('imac')) {
        return '/images/devices/apple-macbook-pro.jpg';
    }
    if (text.includes('macbook_air') || text.includes('macbook air') || text.includes('macbook-air')) {
        return '/images/devices/apple-macbook-air.jpg';
    }
    if (text.includes('thinkpad_x1') || text.includes('thinkpad x1') || text.includes('carbon')) {
        return '/images/devices/lenovo-thinkpad-x1.jpg';
    }
    if (text.includes('thinkpad') || text.includes('t14') || text.includes('e14')) {
        return '/images/devices/lenovo-thinkpad.jpg';
    }
    if (text.includes('ideapad')) {
        return '/images/devices/lenovo-ideapad.jpg';
    }
    if (text.includes('thinkcentre')) {
        return '/images/devices/lenovo-thinkcentre.jpg';
    }
    if (text.includes('xps')) {
        return '/images/devices/dell-xps.jpg';
    }
    if (text.includes('latitude')) {
        return '/images/devices/dell-latitude.jpg';
    }
    if (text.includes('precision')) {
        return '/images/devices/dell-precision.jpg';
    }
    if (text.includes('optiplex')) {
        return '/images/devices/dell-optiplex.jpg';
    }
    if (text.includes('prodesk') || text.includes('elitedesk')) {
        return '/images/devices/hp-prodesk.jpg';
    }
    if (text.includes('elitebook')) {
        return '/images/devices/hp-elitebook.jpg';
    }
    if (text.includes('probook') || text.includes('hp 250')) {
        return '/images/devices/hp-probook.jpg';
    }
    if (text.includes('z8') || text.includes('workstation')) {
        return '/images/devices/hp-workstation.jpg';
    }
    if (text.includes('aspire')) {
        return '/images/devices/acer-aspire.jpg';
    }
    if (text.includes('custom') || text.includes('ai rig')) {
        return '/images/devices/custom-ai-rig.jpg';
    }

    return url || null;
}

function FallbackDeviceIcon({ deviceType }) {
    const iconClass = 'w-5 h-5 text-zinc-400 dark:text-zinc-500';
    if (deviceType === 'laptop') return <RiMacbookLine className={iconClass} />;
    if (deviceType === 'monitor') return <RiTv2Line className={iconClass} />;
    if (deviceType === 'mobile') return <RiSmartphoneLine className={iconClass} />;
    if (deviceType === 'peripheral') return <RiKeyboardLine className={iconClass} />;
    return <RiComputerLine className={iconClass} />;
}

export default function HardwareImage({
    src,
    alt = 'Hardware Device',
    className = 'w-full h-full object-cover',
    deviceType = 'laptop',
    fallbackSrc = null,
    ...props
}) {
    const [hasError, setHasError] = useState(false);
    const [fallbackFailed, setFallbackFailed] = useState(false);

    useEffect(() => {
        setHasError(false);
        setFallbackFailed(false);
    }, [src, alt, deviceType]);

    const defaultFallback = fallbackSrc || (
        deviceType === 'desktop'
            ? '/images/devices/default-desktop.jpg'
            : deviceType === 'monitor'
            ? '/images/devices/default-monitor.svg'
            : deviceType === 'mobile'
            ? '/images/devices/default-mobile.svg'
            : deviceType === 'peripheral'
            ? '/images/devices/default-peripheral.svg'
            : '/images/devices/default-laptop.jpg'
    );

    const resolved = resolveLocalAsset(src, alt);
    const imageSource = !hasError && resolved ? resolved : defaultFallback;

    if (fallbackFailed || !imageSource) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800" aria-label={alt}>
                <FallbackDeviceIcon deviceType={deviceType} />
            </div>
        );
    }

    return (
        <img
            src={imageSource}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => {
                if (!hasError && resolved && imageSource !== defaultFallback) {
                    setHasError(true);
                } else {
                    setFallbackFailed(true);
                }
            }}
            className={`transition-opacity duration-200 ${className}`}
            {...props}
        />
    );
}
