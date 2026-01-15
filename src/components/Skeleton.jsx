import React from 'react';

const Skeleton = ({ className = "", variant = "rect", width, height }) => {
    const baseStyles = "bg-white/10 animate-pulse rounded";
    const variantStyles = variant === "circle" ? "rounded-full" : "rounded";

    const style = {};
    if (width) style.width = width;
    if (height) style.height = height;

    return (
        <div
            className={`${baseStyles} ${variantStyles} ${className}`}
            style={style}
        />
    );
};

export default Skeleton;
