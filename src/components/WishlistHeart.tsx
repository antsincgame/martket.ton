import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../contexts/WishlistContext';

interface Props {
  productId: string;
  /** Visual size variant. */
  size?: 'sm' | 'md';
}

/**
 * Wishlist toggle (heart). Sits inside a clickable card `<Link>`, so it must
 * stop the click from navigating. Guests are sent to sign-in.
 */
const WishlistHeart = memo(({ productId, size = 'sm' }: Props) => {
  const { isSaved, toggle, isAuthenticated } = useWishlist();
  const navigate = useNavigate();
  const saved = isSaved(productId);
  const dim = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAuthenticated) {
        navigate('/sign-in');
        return;
      }
      void toggle(productId);
    },
    [isAuthenticated, navigate, toggle, productId],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={saved}
      title={saved ? 'In your wishlist' : 'Save to wishlist'}
      className={`inline-flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 ${
        size === 'md' ? 'w-9 h-9' : 'w-7 h-7'
      } ${
        saved
          ? 'bg-[#FF3B6B]/15 border-[#FF3B6B]/40 text-[#FF3B6B]'
          : 'bg-black/30 border-white/15 text-white/60 hover:text-[#FF3B6B] hover:border-[#FF3B6B]/30'
      }`}
    >
      <Heart className={`${dim} ${saved ? 'fill-current' : ''}`} />
    </button>
  );
});

WishlistHeart.displayName = 'WishlistHeart';

export default WishlistHeart;
