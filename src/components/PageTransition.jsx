import React from 'react';
import { motion } from 'framer-motion';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} // smooth ease-out-quint
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
