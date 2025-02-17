import React from "react";
import { Helmet } from "react-helmet";

const ClarityScript: React.FC = () => {
  const clarityToken = import.meta.env.VITE_CLARITY_TOKEN || "qbdn9i0kka";

  return (
    <Helmet>
      <script type="text/javascript">
        {`
          (function(c,l,a,r,i,t,y){
            c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/"+i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityToken}");
        `}
      </script>
    </Helmet>
  );
};

export default ClarityScript;
