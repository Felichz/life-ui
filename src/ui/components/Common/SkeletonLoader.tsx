import { Box, Skeleton, Stack } from "@mui/material";

interface SkeletonLoaderProps {
  type: "kanban" | "timeline" | "variable" | "card" | "chart";
  count?: number;
}

const SkeletonLoader = ({ type, count = 3 }: SkeletonLoaderProps) => {
  switch (type) {
    case "kanban":
      return (
        <Box sx={{ display: "flex", gap: 2, width: "100%", overflowX: "hidden" }}>
          {Array.from({ length: count }).map((_, index) => (
            <Box key={index} sx={{ width: 280, flexShrink: 0 }}>
              <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
              {Array.from({ length: 3 }).map((_, cardIndex) => (
                <Skeleton
                  key={cardIndex}
                  variant="rectangular"
                  height={100}
                  sx={{
                    mb: 1,
                    borderRadius: 1,
                  }}
                />
              ))}
            </Box>
          ))}
        </Box>
      );

    case "timeline":
      return (
        <Box sx={{ width: "100%" }}>
          <Skeleton variant="rectangular" height={30} sx={{ mb: 2 }} />
          {Array.from({ length: count }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              height={50}
              sx={{
                mb: 1,
                borderRadius: 1,
              }}
            />
          ))}
        </Box>
      );

    case "variable":
      return (
        <Box sx={{ width: "100%" }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        </Box>
      );

    case "card":
      return (
        <Box sx={{ width: 280 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={80} />
        </Box>
      );

    case "chart":
      return (
        <Box
          sx={{
            width: "100%",
            height: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Gráfico circular con skeleton */}
          <Box sx={{ position: "relative", width: 300, height: 300 }}>
            <Skeleton variant="circular" width={300} height={300} />
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <Skeleton
                variant="circular"
                width={150}
                height={150}
                sx={{ bgcolor: "background.paper" }}
              />
            </Box>
          </Box>
        </Box>
      );

    default:
      return (
        <Stack spacing={1} sx={{ width: "100%" }}>
          <Skeleton variant="rectangular" height={60} />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
        </Stack>
      );
  }
};

export default SkeletonLoader;
