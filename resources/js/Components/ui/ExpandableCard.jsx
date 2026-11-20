import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { cn } from '@/lib/utils';
import { RiCloseLine } from 'react-icons/ri';

/**
 * Aceternity Expandable Card container & trigger system.
 */
export function ExpandableCardContainer({
    cards = [],
    renderCard,
    renderExpanded,
    gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
}) {
    const [active, setActive] = useState(null);
    const activeRef = useRef(null);

    useOutsideClick(activeRef, () => setActive(null));

    return (
        <>
            <AnimatePresence>
                {active && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs h-full w-full z-50"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {active ? (
                    <div className="fixed inset-0 grid place-items-center z-50 p-4 sm:p-6 overflow-y-auto">
                        <motion.div
                            layoutId={`card-${active.id}`}
                            ref={activeRef}
                            className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-sm overflow-hidden relative my-8"
                        >
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setActive(null)}
                                className="absolute top-4 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </motion.button>

                            <div className="p-6">
                                {renderExpanded(active, () => setActive(null))}
                            </div>
                        </motion.div>
                    </div>
                ) : null}
            </AnimatePresence>

            <div className={gridClassName}>
                {cards.map((card) => (
                    <motion.div
                        layoutId={`card-${card.id}`}
                        key={card.id}
                        onClick={() => setActive(card)}
                        className="cursor-pointer group"
                    >
                        {renderCard(card, () => setActive(card))}
                    </motion.div>
                ))}
            </div>
        </>
    );
}

export default ExpandableCardContainer;
