import { memo } from 'react';
import { motion } from 'framer-motion';

const HomeValueProp = memo(() => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="text-center max-w-2xl mx-auto px-4 py-1"
    >
      <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
        Digital artifacts forged on <span className="text-[#00F5FF] font-semibold">TON</span>.{' '}
        Paid creators. Instant delivery.{' '}
        <span className="text-[#FFD700] font-semibold">Zero intermediaries.</span>
      </p>
    </motion.div>
  );
});

HomeValueProp.displayName = 'HomeValueProp';

export default HomeValueProp;
