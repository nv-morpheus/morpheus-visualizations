import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import * as icons from "react-bootstrap-icons";

const Icon = ({ iconName, ...props }) => {
  const BootstrapIcon = icons[iconName];
  return <BootstrapIcon {...props} />;
};

function Trigger({
  msg,
  msgs = [],
  className,
  iconName,
  placement = "right",
  onClick = null,
}) {
  const renderTooltip = (props) => (
    <Tooltip id="button-tooltip" {...props}>
      {msgs.length == 0 ? <span>{msg}</span> : msgs.map((m) => <p>{m}</p>)}
    </Tooltip>
  );

  return (
    <span className={className}>
      <OverlayTrigger
        placement={placement}
        delay={{ show: 250, hide: 400 }}
        overlay={renderTooltip}
      >
        <a href="#" onClick={onClick}>
          <Icon iconName={iconName} color={"white"} size={15} />
        </a>
      </OverlayTrigger>
    </span>
  );
}

export default Trigger;
