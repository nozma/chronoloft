import { useState } from 'react';
import { Box, ClickAwayListener, Tooltip, useMediaQuery } from '@mui/material';

export default function InfoTooltip({ title, children }) {
    const hasNoHover = useMediaQuery('(hover: none)');
    const [open, setOpen] = useState(false);

    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <Tooltip
                title={title}
                arrow
                open={hasNoHover ? open : undefined}
                disableTouchListener={hasNoHover}
                onClose={() => setOpen(false)}
            >
                <Box component="span" sx={{ display: 'inline-flex', verticalAlign: 'middle' }}
                    onClick={hasNoHover ? () => setOpen(value => !value) : undefined}>
                    {children}
                </Box>
            </Tooltip>
        </ClickAwayListener>
    );
}

